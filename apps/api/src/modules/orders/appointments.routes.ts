import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireActiveSubscription } from '../../middleware/requireSubscription.js'
import { appointmentsRepository } from './appointments.repository.js'
import { setAppointmentStatus } from './appointments.service.js'
import { Errors } from '../../utils/errors.js'

const statusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']),
  // Dată+oră concretă (epoch ms) — obligatorie la confirmare (owner-ul o setează).
  scheduledAt: z.number().int().positive().optional(),
}).refine(d => d.status !== 'confirmed' || d.scheduledAt != null, {
  message: 'Setează data și ora la confirmare', path: ['scheduledAt'],
})

export async function appointmentsRoutes(app: FastifyInstance) {
  // Listă programări cu serviciile lor (pentru dashboard)
  app.get('/', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const list = await appointmentsRepository.list(req.user!.id)
    const withItems = await Promise.all(list.map(async appt => ({
      ...appt,
      items: await appointmentsRepository.getItems(appt.id),
    })))
    return reply.send({ appointments: withItems })
  })

  app.patch('/:id/status', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    const result = statusSchema.safeParse(req.body)
    if (!result.success) throw Errors.validation(result.error.issues.map(e => ({ field: String(e.path[0]), message: e.message })))

    const existing = await appointmentsRepository.findById(req.user!.id, id)
    if (!existing) throw Errors.notFound('Appointment')

    // Sursă unică (service): schimbă statusul + notifică clientul la tranziție reală. Folosit și de
    // comenzile owner pe WhatsApp (#6).
    const { notified } = await setAppointmentStatus(req.user!.id, existing, result.data.status, result.data.scheduledAt)
    return reply.send({ ok: true, notified })
  })

  app.delete('/:id', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    const existing = await appointmentsRepository.findById(req.user!.id, id)
    if (!existing) throw Errors.notFound('Appointment')

    await appointmentsRepository.delete(req.user!.id, id)
    return reply.code(204).send()
  })
}
