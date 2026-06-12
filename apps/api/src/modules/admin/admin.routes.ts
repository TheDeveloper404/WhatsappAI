import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { adminRepository } from './admin.repository.js'
import { notificationsRepository } from '../notifications/notifications.repository.js'
import { env } from '../../config/env.js'
import { Errors } from '../../utils/errors.js'
import { sendCustomEmail } from '../../utils/email.js'
import { getActiveLLMProvider } from '../ai/groq.client.js'
import { logger } from '../../utils/logger.js'
import { timingSafeEqual } from 'crypto'
import { verify as verifyTotp } from 'otplib'
import { createAdminSession, verifyAdminSession } from '../../utils/tokens.js'

// Comparație constant-time pentru secretul de admin — evită timing side-channel.
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Bearer-ul este acum un token de sesiune semnat (emis de POST /auth), nu secretul brut.
// Secretul nu mai circulă după login, iar sesiunea expiră în 2h.
function verifyAdminToken(req: { headers: { authorization?: string } }) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) throw Errors.unauthorized('Token admin lipsă.')
  try {
    verifyAdminSession(header.slice(7))
  } catch {
    throw Errors.unauthorized('Token admin invalid sau expirat.')
  }
}

// Guard de autorizare în lanțul de hook-uri (L-2): aplicat ca preHandler pe TOATE rutele admin
// protejate (toate în afară de POST /auth, care emite token-ul). Autorizarea stă în preHandler,
// nu în corpul handler-ului — o rută nouă fără guard rămâne vizibil neprotejată, nu tăcut.
const adminGuard = async (req: FastifyRequest) => verifyAdminToken(req)

// Rate limit pe rutele admin distructive (L3), dezactivat în test/E2E (ca în auth.routes).
const rl = (max: number, timeWindow: string) =>
  process.env.NODE_ENV === 'test' || process.env.E2E_MODE === 'true'
    ? {}
    : { config: { rateLimit: { max, timeWindow } } }

// Validare input cu Zod (M-1), consecvent cu pattern-ul din ai.routes/auth.controller:
// câmpurile necunoscute sunt eliminate, erorile sunt mapate pe forma Errors.validation.
function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw Errors.validation(result.error.issues.map(e => ({ field: String(e.path[0]), message: e.message })))
  }
  return result.data
}
const userIdParams = z.object({ userId: z.string().uuid() })
const agentBody = z.object({ isActive: z.boolean() })
const emailBody = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
})

// Whitelist de chei la PATCH /config (M5/L4): doar cheile pe care le citește efectiv app-ul.
// Blochează injectarea de chei arbitrare (poisoning / junk) în config-ul de platformă.
const ALLOWED_CONFIG_KEYS = new Set(['default_system_prompt'])

// Audit log acțiuni admin (M5). Fail-soft: o eroare de jurnalizare nu blochează acțiunea.
async function audit(req: { ip?: string }, action: string, targetUserId: string | null = null, metadata?: Record<string, unknown>) {
  try {
    await adminRepository.logAdminAction(action, targetUserId, metadata ? JSON.stringify(metadata) : null, req.ip ?? null)
  } catch (err) {
    logger.error('[admin] audit log failed', { err: String(err) })
  }
}

export async function adminRoutes(app: FastifyInstance) {
  // POST /admin/auth — public (emite token-ul de sesiune); NU primește adminGuard.
  // Rate limit prin rl() → dezactivat în test/E2E (la fel ca restul rutelor admin), altfel
  // suita E2E (zeci de login-uri admin) lovește limita de 10/15min și pică pe 429.
  app.post('/auth', rl(10, '15 minutes'), async (req, reply) => {
    const { secret, totp } = req.body as { secret?: string; totp?: string }
    if (!secret || !env.ADMIN_SECRET || !secretsMatch(secret, env.ADMIN_SECRET)) {
      throw Errors.unauthorized('Cod incorect.')
    }
    // 2FA (TOTP): activă DOAR dacă ADMIN_TOTP_SECRET e setat (altfel sărit — dev/test/back-compat).
    // epochTolerance 30s = iartă un pas de decalaj de ceas între telefon și server.
    if (env.ADMIN_TOTP_SECRET) {
      const code = totp?.trim()
      if (!code) throw Errors.unauthorized('Cod 2FA lipsă.')
      const result = await verifyTotp({ secret: env.ADMIN_TOTP_SECRET, token: code, epochTolerance: 30 })
      if (!result.valid) throw Errors.unauthorized('Cod 2FA incorect.')
    }
    return reply.send({ ok: true, token: createAdminSession() })
  })

  // GET /admin/users
  app.get('/users', { preHandler: adminGuard }, async (_req, reply) => {
    const users = await adminRepository.listUsers()
    return reply.send({ users })
  })

  // GET /admin/stats
  app.get('/stats', { preHandler: adminGuard }, async (_req, reply) => {
    const [stats, { getActiveSessionCount }] = await Promise.all([
      adminRepository.getStats(),
      import('../whatsapp/whatsapp.session-manager.js'),
    ])
    return reply.send({ ...stats, llmProvider: getActiveLLMProvider(), activeSockets: getActiveSessionCount() })
  })

  // PATCH /admin/users/:userId/agent
  app.patch('/users/:userId/agent', { preHandler: adminGuard }, async (req, reply) => {
    const { userId } = parse(userIdParams, req.params)
    const { isActive } = parse(agentBody, req.body)
    await adminRepository.setAgentActive(userId, isActive)
    await audit(req, 'user.set_agent_active', userId, { isActive })
    return reply.send({ ok: true })
  })

  // POST /admin/users/:userId/extend-trial
  app.post('/users/:userId/extend-trial', { preHandler: adminGuard, ...rl(30, '5 minutes') }, async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const { days } = req.body as { days: number }
    if (!days || days < 1 || days > 365) throw Errors.validation([{ field: 'days', message: 'Zile invalide (1-365).' }])
    await adminRepository.extendTrial(userId, days)
    // B15 — anunță userul în dashboard că i s-a prelungit trial-ul (best-effort: un eșec aici nu
    // trebuie să rateze extinderea, care e deja făcută).
    try {
      await notificationsRepository.create(
        userId,
        'trial_extended',
        'Trial prelungit',
        `Echipa waai.ro ți-a prelungit perioada de trial cu ${days} ${days === 1 ? 'zi' : 'zile'}.`,
      )
    } catch (err) {
      logger.error('[admin] notificare prelungire trial eșuată', { err: String(err) })
    }
    await audit(req, 'user.extend_trial', userId, { days })
    return reply.send({ ok: true })
  })

  // POST /admin/users/:userId/disconnect-wa
  app.post('/users/:userId/disconnect-wa', { preHandler: adminGuard }, async (req, reply) => {
    const { userId } = req.params as { userId: string }
    try {
      const { disconnectSession } = await import('../whatsapp/whatsapp.session-manager.js')
      await disconnectSession(userId)
    } catch {}
    await audit(req, 'user.disconnect_wa', userId)
    return reply.send({ ok: true })
  })

  // DELETE /admin/users/:userId
  app.delete('/users/:userId', { preHandler: adminGuard, ...rl(20, '5 minutes') }, async (req, reply) => {
    const { userId } = req.params as { userId: string }
    await adminRepository.deleteUser(userId)
    await audit(req, 'user.delete', userId)
    return reply.send({ ok: true })
  })

  // POST /admin/users/:userId/email
  app.post('/users/:userId/email', { preHandler: adminGuard, ...rl(20, '5 minutes') }, async (req, reply) => {
    const { userId } = parse(userIdParams, req.params)
    const { subject, body } = parse(emailBody, req.body)
    const users = await adminRepository.listUsers()
    const user = users.find(u => u.id === userId)
    if (!user) throw Errors.notFound('User negăsit.')
    await sendCustomEmail(user.email, subject, body).catch(err =>
      logger.error('[admin] email send failed', { err: err.message })
    )
    await audit(req, 'user.email', userId, { subject })
    return reply.send({ ok: true })
  })

  // GET /admin/notifications
  app.get('/notifications', { preHandler: adminGuard }, async (_req, reply) => {
    const items = await adminRepository.getAdminNotifications()
    const unreadCount = await adminRepository.getAdminUnreadCount()
    return reply.send({ notifications: items, unreadCount })
  })

  // POST /admin/notifications/read
  app.post('/notifications/read', { preHandler: adminGuard }, async (_req, reply) => {
    await adminRepository.markAdminNotificationsRead()
    return reply.send({ ok: true })
  })

  // DELETE /admin/notifications
  app.delete('/notifications', { preHandler: adminGuard }, async (_req, reply) => {
    await adminRepository.deleteAllAdminNotifications()
    return reply.send({ ok: true })
  })

  // DELETE /admin/notifications/:notificationId
  app.delete('/notifications/:notificationId', { preHandler: adminGuard }, async (req, reply) => {
    const { notificationId } = req.params as { notificationId: string }
    await adminRepository.deleteAdminNotification(notificationId)
    return reply.send({ ok: true })
  })

  // GET /admin/config
  app.get('/config', { preHandler: adminGuard }, async (_req, reply) => {
    const config = await adminRepository.getPlatformConfig()
    return reply.send({ config })
  })

  // PATCH /admin/config — doar chei din whitelist (M5/L4).
  app.patch('/config', { preHandler: adminGuard, ...rl(30, '5 minutes') }, async (req, reply) => {
    const updates = req.body as Record<string, unknown>
    const invalid = Object.keys(updates).filter(k => !ALLOWED_CONFIG_KEYS.has(k))
    if (invalid.length) {
      throw Errors.validation(invalid.map(k => ({ field: k, message: 'Cheie de configurare nepermisă.' })))
    }
    const applied: string[] = []
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'string') {
        await adminRepository.setPlatformConfig(key, value)
        applied.push(key)
      }
    }
    await audit(req, 'config.update', null, { keys: applied })
    return reply.send({ ok: true })
  })

  // GET /admin/audit — jurnalul de acțiuni admin (M5).
  app.get('/audit', { preHandler: adminGuard }, async (_req, reply) => {
    const entries = await adminRepository.getAuditLog(100)
    return reply.send({ entries })
  })
}
