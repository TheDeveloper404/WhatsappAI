import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { notificationsRepository } from './notifications.repository.js'

// Rute user-facing pentru notificările în-app (B15). DOAR `authenticate` ca preHandler —
// intenționat FĂRĂ `requireActiveSubscription`: userul trebuie să-și vadă notificările chiar
// dacă trial-ul/abonamentul a expirat (ex. tocmai notificarea „trial prelungit" e relevantă atunci).
// Resursele sunt scopate pe `req.user!.id` în repository → IDOR-safe.
export async function notificationsRoutes(app: FastifyInstance) {
  // Listă (max 50, desc) + nr. necitite, pentru clopoțelul din dashboard.
  app.get('/', { preHandler: [authenticate] }, async (req, reply) => {
    const userId = req.user!.id
    const [items, unreadCount] = await Promise.all([
      notificationsRepository.listForUser(userId),
      notificationsRepository.unreadCount(userId),
    ])
    return reply.send({ notifications: items, unreadCount })
  })

  // Marchează toate ca citite (la deschiderea clopoțelului).
  app.post('/read', { preHandler: [authenticate] }, async (req, reply) => {
    await notificationsRepository.markAllRead(req.user!.id)
    return reply.send({ ok: true })
  })
}
