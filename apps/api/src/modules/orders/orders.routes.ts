import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireActiveSubscription } from '../../middleware/requireSubscription.js'
import { ordersRepository } from './orders.repository.js'
import { sendToContact } from '../whatsapp/whatsapp.session-manager.js'
import { logger } from '../../utils/logger.js'
import { Errors } from '../../utils/errors.js'

const statusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']),
})

// Mesaje proactive către client la schimbarea statusului de către owner (Faza 3).
// `pending` nu notifică (e starea inițială). Textul e fix, în cod — nu trece prin LLM.
const STATUS_CLIENT_MESSAGE: Record<string, string | null> = {
  pending: null,
  confirmed: '✅ Comanda ta a fost confirmată! O pregătim și revenim cu detalii în curând. Mulțumim!',
  completed: '🎉 Comanda ta a fost finalizată. Îți mulțumim și te mai așteptăm!',
  cancelled: 'ℹ️ Comanda ta a fost anulată. Dacă a fost o greșeală sau ai întrebări, scrie-ne aici.',
}

export async function ordersRoutes(app: FastifyInstance) {
  // Listă comenzi cu liniile lor (pentru dashboard)
  app.get('/', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const list = await ordersRepository.list(req.user!.id)
    const withItems = await Promise.all(list.map(async order => ({
      ...order,
      items: await ordersRepository.getItems(order.id),
    })))
    return reply.send({ orders: withItems })
  })

  app.patch('/:id/status', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    const result = statusSchema.safeParse(req.body)
    if (!result.success) throw Errors.validation(result.error.errors.map(e => ({ field: String(e.path[0]), message: e.message })))

    const existing = await ordersRepository.findById(req.user!.id, id)
    if (!existing) throw Errors.notFound('Order')

    const newStatus = result.data.status
    await ordersRepository.updateStatus(req.user!.id, id, newStatus)

    // Notifică clientul DOAR la tranziție reală de status (nu la re-setarea aceluiași).
    // Fail-soft: dacă WhatsApp nu e conectat, statusul tot se salvează în dashboard.
    let notified = false
    if (newStatus !== existing.status) {
      const message = STATUS_CLIENT_MESSAGE[newStatus]
      if (message) {
        try {
          notified = await sendToContact(req.user!.id, existing.contactPhone, message)
        } catch (err) {
          logger.error(`[orders] notificare status eșuată`, { err: String(err) })
        }
      }
    }

    return reply.send({ ok: true, notified })
  })

  app.delete('/:id', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    const existing = await ordersRepository.findById(req.user!.id, id)
    if (!existing) throw Errors.notFound('Order')

    await ordersRepository.delete(req.user!.id, id)
    return reply.code(204).send()
  })
}
