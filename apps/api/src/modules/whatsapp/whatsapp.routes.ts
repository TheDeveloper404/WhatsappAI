import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { requireActiveSubscription } from '../../middleware/requireSubscription.js'
import { whatsappService } from './whatsapp.service.js'

export async function whatsappRoutes(app: FastifyInstance) {
  app.get('/session', { preHandler: authenticate }, async (req, reply) => {
    const session = await whatsappService.getSession(req.user!.id)
    return reply.send({ session })
  })

  app.post('/connect', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } }, preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const { qrCode } = await whatsappService.connect(req.user!.id)
    return reply.send({ qrCode })
  })

  app.post('/disconnect', { preHandler: authenticate }, async (req, reply) => {
    await whatsappService.disconnect(req.user!.id)
    return reply.send({ ok: true })
  })
}
