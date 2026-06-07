import type { FastifyInstance } from 'fastify'
import { adminRepository } from './admin.repository.js'
import { env } from '../../config/env.js'
import { Errors } from '../../utils/errors.js'
import { sendCustomEmail } from '../../utils/email.js'
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

// Rate limit pe rutele admin distructive (L3), dezactivat în test/E2E (ca în auth.routes).
const rl = (max: number, timeWindow: string) =>
  process.env.NODE_ENV === 'test' || process.env.E2E_MODE === 'true'
    ? {}
    : { config: { rateLimit: { max, timeWindow } } }

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
  // POST /admin/auth
  app.post('/auth', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
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
  app.get('/users', async (req, reply) => {
    verifyAdminToken(req)
    const users = await adminRepository.listUsers()
    return reply.send({ users })
  })

  // GET /admin/stats
  app.get('/stats', async (req, reply) => {
    verifyAdminToken(req)
    const stats = await adminRepository.getStats()
    return reply.send(stats)
  })

  // PATCH /admin/users/:userId/agent
  app.patch('/users/:userId/agent', async (req, reply) => {
    verifyAdminToken(req)
    const { userId } = req.params as { userId: string }
    const { isActive } = req.body as { isActive: boolean }
    await adminRepository.setAgentActive(userId, isActive)
    await audit(req, 'user.set_agent_active', userId, { isActive })
    return reply.send({ ok: true })
  })

  // POST /admin/users/:userId/extend-trial
  app.post('/users/:userId/extend-trial', rl(30, '5 minutes'), async (req, reply) => {
    verifyAdminToken(req)
    const { userId } = req.params as { userId: string }
    const { days } = req.body as { days: number }
    if (!days || days < 1 || days > 365) throw Errors.validation([{ field: 'days', message: 'Zile invalide (1-365).' }])
    await adminRepository.extendTrial(userId, days)
    await audit(req, 'user.extend_trial', userId, { days })
    return reply.send({ ok: true })
  })

  // POST /admin/users/:userId/disconnect-wa
  app.post('/users/:userId/disconnect-wa', async (req, reply) => {
    verifyAdminToken(req)
    const { userId } = req.params as { userId: string }
    try {
      const { disconnectSession } = await import('../whatsapp/whatsapp.session-manager.js')
      await disconnectSession(userId)
    } catch {}
    await audit(req, 'user.disconnect_wa', userId)
    return reply.send({ ok: true })
  })

  // DELETE /admin/users/:userId
  app.delete('/users/:userId', rl(20, '5 minutes'), async (req, reply) => {
    verifyAdminToken(req)
    const { userId } = req.params as { userId: string }
    await adminRepository.deleteUser(userId)
    await audit(req, 'user.delete', userId)
    return reply.send({ ok: true })
  })

  // POST /admin/users/:userId/email
  app.post('/users/:userId/email', rl(20, '5 minutes'), async (req, reply) => {
    verifyAdminToken(req)
    const { userId } = req.params as { userId: string }
    const { subject, body } = req.body as { subject: string; body: string }
    if (!subject?.trim() || !body?.trim()) throw Errors.validation([{ field: 'subject', message: 'Subiect și mesaj obligatorii.' }])
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
  app.get('/notifications', async (req, reply) => {
    verifyAdminToken(req)
    const items = await adminRepository.getAdminNotifications()
    const unreadCount = await adminRepository.getAdminUnreadCount()
    return reply.send({ notifications: items, unreadCount })
  })

  // POST /admin/notifications/read
  app.post('/notifications/read', async (req, reply) => {
    verifyAdminToken(req)
    await adminRepository.markAdminNotificationsRead()
    return reply.send({ ok: true })
  })

  // DELETE /admin/notifications
  app.delete('/notifications', async (req, reply) => {
    verifyAdminToken(req)
    await adminRepository.deleteAllAdminNotifications()
    return reply.send({ ok: true })
  })

  // DELETE /admin/notifications/:notificationId
  app.delete('/notifications/:notificationId', async (req, reply) => {
    verifyAdminToken(req)
    const { notificationId } = req.params as { notificationId: string }
    await adminRepository.deleteAdminNotification(notificationId)
    return reply.send({ ok: true })
  })

  // GET /admin/config
  app.get('/config', async (req, reply) => {
    verifyAdminToken(req)
    const config = await adminRepository.getPlatformConfig()
    return reply.send({ config })
  })

  // PATCH /admin/config — doar chei din whitelist (M5/L4).
  app.patch('/config', rl(30, '5 minutes'), async (req, reply) => {
    verifyAdminToken(req)
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
  app.get('/audit', async (req, reply) => {
    verifyAdminToken(req)
    const entries = await adminRepository.getAuditLog(100)
    return reply.send({ entries })
  })
}
