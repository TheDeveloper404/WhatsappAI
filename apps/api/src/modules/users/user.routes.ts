import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { authRepository } from '../auth/auth.repository.js'
import { verifyPassword } from '../../utils/password.js'
import { sendAccountDeletionEmail } from '../../utils/email.js'
import { Errors } from '../../utils/errors.js'

// Rate-limit dezactivat în test/E2E pentru a evita flakiness (ca în auth.routes).
const rl = (max: number, timeWindow: string) =>
  process.env.NODE_ENV === 'test' || process.env.E2E_MODE === 'true'
    ? {}
    : { config: { rateLimit: { max, timeWindow } } }

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

  // Ștergerea contului cere reintroducerea parolei — nu se poate declanșa accidental
  // sau cu un access token furat fără a cunoaște parola. Rate-limit strict pe încercări.
  app.delete('/me', { ...rl(5, '15 minutes'), preHandler: authenticate }, async (req, reply) => {
    const result = z.object({ password: z.string().min(1) }).safeParse(req.body)
    if (!result.success) throw Errors.validation([{ field: 'password', message: 'Parola este obligatorie pentru a șterge contul.' }])

    const user = await authRepository.findUserById(req.user!.id)
    if (!user) throw Errors.notFound('User')
    if (user.deletionScheduledAt) throw Errors.validation([{ field: 'account', message: 'Contul este deja programat pentru ștergere.' }])

    const passwordOk = await verifyPassword(result.data.password, user.passwordHash)
    if (!passwordOk) throw Errors.unauthorized('Parolă incorectă.')

    await authRepository.scheduleUserDeletion(user.id)
    sendAccountDeletionEmail(user.email, user.name).catch(() => {})
    return reply.send({ ok: true })
  })
}
