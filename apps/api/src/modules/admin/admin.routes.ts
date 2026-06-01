import type { FastifyInstance } from 'fastify'
import { adminRepository } from './admin.repository.js'
import { env } from '../../config/env.js'
import { Errors } from '../../utils/errors.js'
import { sendCustomEmail } from '../../utils/email.js'
import { logger } from '../../utils/logger.js'
import { timingSafeEqual } from 'crypto'

// Comparație constant-time pentru secretul de admin — evită timing side-channel.
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function verifyAdminToken(req: { headers: { authorization?: string } }) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) throw Errors.unauthorized('Token admin lipsă.')
  const token = header.slice(7)
  if (!env.ADMIN_SECRET || !secretsMatch(token, env.ADMIN_SECRET)) throw Errors.unauthorized('Token admin invalid.')
}

export async function adminRoutes(app: FastifyInstance) {
  // POST /admin/auth
  app.post('/auth', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const { secret } = req.body as { secret?: string }
    if (!secret || !env.ADMIN_SECRET || !secretsMatch(secret, env.ADMIN_SECRET)) {
      throw Errors.unauthorized('Cod incorect.')
    }
    return reply.send({ ok: true })
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
    return reply.send({ ok: true })
  })

  // POST /admin/users/:userId/extend-trial
  app.post('/users/:userId/extend-trial', async (req, reply) => {
    verifyAdminToken(req)
    const { userId } = req.params as { userId: string }
    const { days } = req.body as { days: number }
    if (!days || days < 1 || days > 365) throw Errors.validation([{ field: 'days', message: 'Zile invalide (1-365).' }])
    await adminRepository.extendTrial(userId, days)
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
    return reply.send({ ok: true })
  })

  // DELETE /admin/users/:userId
  app.delete('/users/:userId', async (req, reply) => {
    verifyAdminToken(req)
    const { userId } = req.params as { userId: string }
    await adminRepository.deleteUser(userId)
    return reply.send({ ok: true })
  })

  // POST /admin/users/:userId/email
  app.post('/users/:userId/email', async (req, reply) => {
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

  // PATCH /admin/config
  app.patch('/config', async (req, reply) => {
    verifyAdminToken(req)
    const updates = req.body as Record<string, string>
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'string') {
        await adminRepository.setPlatformConfig(key, value)
      }
    }
    return reply.send({ ok: true })
  })
}
