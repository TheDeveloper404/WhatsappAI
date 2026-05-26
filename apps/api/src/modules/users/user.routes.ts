import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { authRepository } from '../auth/auth.repository.js'
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
}
