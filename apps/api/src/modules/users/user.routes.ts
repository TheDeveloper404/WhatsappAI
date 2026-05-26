import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { authRepository } from '../auth/auth.repository.js'
import { sendAccountDeletionEmail } from '../../utils/email.js'
import { Errors } from '../../utils/errors.js'

export async function userRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: authenticate }, async (req, reply) => {
    const user = await authRepository.findUserById(req.user!.id)
    if (!user) throw Errors.notFound('User')
    return reply.send({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
    })
  })

  app.delete('/me', { preHandler: authenticate }, async (req, reply) => {
    const user = await authRepository.findUserById(req.user!.id)
    if (!user) throw Errors.notFound('User')
    if (user.deletionScheduledAt) throw Errors.validation([{ field: 'account', message: 'Contul este deja programat pentru ștergere.' }])
    await authRepository.scheduleUserDeletion(user.id)
    sendAccountDeletionEmail(user.email, user.name).catch(() => {})
    return reply.send({ ok: true })
  })
}
