import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { appointmentsRepository } from './appointments.repository.js'
import { sendToContact } from '../whatsapp/whatsapp.session-manager.js'
import { logger } from '../../utils/logger.js'
import { Errors } from '../../utils/errors.js'

const statusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']),
})

export async function appointmentsRoutes(app: FastifyInstance) {
  // Listă programări (pentru dashboard)
  app.get('/', { preHandler: authenticate }, async (req, reply) => {
    const list = await appointmentsRepository.list(req.user!.id)
    return reply.send({ appointments: list })
  })

  app.patch('/:id/status', { preHandler: authenticate }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    const result = statusSchema.safeParse(req.body)
    if (!result.success) throw Errors.validation(result.error.errors.map(e => ({ field: String(e.path[0]), message: e.message })))

    const existing = await appointmentsRepository.findById(req.user!.id, id)
    if (!existing) throw Errors.notFound('Appointment')

    const newStatus = result.data.status
    await appointmentsRepository.updateStatus(req.user!.id, id, newStatus)

    // Notifică clientul DOAR la tranziție reală de status (nu la re-setarea aceluiași). Text fix, în cod.
    // Fail-soft: dacă WhatsApp nu e conectat, statusul tot se salvează în dashboard.
    let notified = false
    if (newStatus !== existing.status) {
      const slot = existing.requestedSlot.trim() ? ` (${existing.requestedSlot.trim()})` : ''
      const messages: Record<string, string | null> = {
        pending: null,
        confirmed: `✅ Programarea ta pentru „${existing.serviceName}"${slot} a fost confirmată! Te așteptăm.`,
        completed: `🎉 Mulțumim că ai trecut pe la noi! Te mai așteptăm.`,
        cancelled: `ℹ️ Programarea ta pentru „${existing.serviceName}"${slot} a fost anulată. Scrie-ne dacă vrei altă dată.`,
      }
      const message = messages[newStatus]
      if (message) {
        try {
          notified = await sendToContact(req.user!.id, existing.contactPhone, message)
        } catch (err) {
          logger.error(`[appointments] notificare status eșuată`, { err: String(err) })
        }
      }
    }

    return reply.send({ ok: true, notified })
  })

  app.delete('/:id', { preHandler: authenticate }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    const existing = await appointmentsRepository.findById(req.user!.id, id)
    if (!existing) throw Errors.notFound('Appointment')

    await appointmentsRepository.delete(req.user!.id, id)
    return reply.code(204).send()
  })
}
