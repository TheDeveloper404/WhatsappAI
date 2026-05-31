import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { ordersRepository } from './orders.repository.js'
import { Errors } from '../../utils/errors.js'

const statusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']),
})

export async function ordersRoutes(app: FastifyInstance) {
  // Listă comenzi cu liniile lor (pentru dashboard)
  app.get('/', { preHandler: authenticate }, async (req, reply) => {
    const list = await ordersRepository.list(req.user!.id)
    const withItems = await Promise.all(list.map(async order => ({
      ...order,
      items: await ordersRepository.getItems(order.id),
    })))
    return reply.send({ orders: withItems })
  })

  app.patch('/:id/status', { preHandler: authenticate }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    const result = statusSchema.safeParse(req.body)
    if (!result.success) throw Errors.validation(result.error.errors.map(e => ({ field: String(e.path[0]), message: e.message })))

    const existing = await ordersRepository.findById(req.user!.id, id)
    if (!existing) throw Errors.notFound('Order')

    await ordersRepository.updateStatus(req.user!.id, id, result.data.status)
    return reply.send({ ok: true })
  })

  app.delete('/:id', { preHandler: authenticate }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    const existing = await ordersRepository.findById(req.user!.id, id)
    if (!existing) throw Errors.notFound('Order')

    await ordersRepository.delete(req.user!.id, id)
    return reply.code(204).send()
  })
}
