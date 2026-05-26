import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { billingService } from './billing.service.js'
import { Errors } from '../../utils/errors.js'
import { z } from 'zod'

const checkoutSchema = z.object({ plan: z.enum(['monthly', 'annual']) })

export async function billingRoutes(app: FastifyInstance) {
  app.post('/checkout', { preHandler: authenticate }, async (req, reply) => {
    const result = checkoutSchema.safeParse(req.body)
    if (!result.success) throw Errors.validation(result.error.errors.map(e => ({ field: String(e.path[0]), message: e.message })))

    const { url } = await billingService.createCheckoutSession(req.user!.id, result.data.plan)
    return reply.send({ url })
  })

  app.post('/portal', { preHandler: authenticate }, async (req, reply) => {
    const { url } = await billingService.createPortalSession(req.user!.id)
    return reply.send({ url })
  })

  app.get('/subscription', { preHandler: authenticate }, async (req, reply) => {
    const sub = await billingService.getSubscription(req.user!.id)
    return reply.send({ subscription: sub ?? null })
  })
}
