import { randomUUID } from 'crypto'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../../config/database.js'
import { appointments, appointmentItems } from '../../db/schema.js'
import type { Appointment, AppointmentItem } from '../../db/schema.js'

// Referință scurtă lizibilă pentru programare (ex. „prg_a1b2c3"). Doar hex → fără caractere ambigue.
function genPublicRef(): string {
  return 'prg_' + randomUUID().replace(/-/g, '').slice(0, 6)
}

export type AppointmentServiceInput = {
  productId: string | null
  serviceName: string
  unitPriceBani: number
}

export type AppointmentInput = {
  // Unul sau mai multe servicii (B10). Eticheta combinată + totalul se derivă din ele.
  services: AppointmentServiceInput[]
  requestedSlot: string
  details: string
}

export const appointmentsRepository = {
  // Creează o programare 'pending' + liniile (serviciile) ei. Owner-ul confirmă intervalul.
  // serviceName (denormalizat) = eticheta combinată; totalBani = suma serviciilor.
  async create(userId: string, contactPhone: string, data: AppointmentInput): Promise<Appointment> {
    const now = Date.now()
    const services = data.services.length > 0 ? data.services : [{ productId: null, serviceName: '(serviciu)', unitPriceBani: 0 }]
    const combinedName = services.map(s => s.serviceName).join(' + ')
    const totalBani = services.reduce((sum, s) => sum + (s.unitPriceBani || 0), 0)
    const appointment = {
      id: randomUUID(),
      publicRef: genPublicRef(),
      userId,
      contactPhone,
      status: 'pending' as const,
      serviceName: combinedName,
      totalBani,
      requestedSlot: data.requestedSlot,
      details: data.details,
      createdAt: now,
      updatedAt: now,
    }
    await db.insert(appointments).values(appointment)
    await db.insert(appointmentItems).values(services.map(s => ({
      id: randomUUID(),
      appointmentId: appointment.id,
      productId: s.productId,
      serviceName: s.serviceName,
      unitPriceBani: s.unitPriceBani || 0,
    })))
    return appointment
  },

  async getItems(appointmentId: string): Promise<AppointmentItem[]> {
    return db.select().from(appointmentItems).where(eq(appointmentItems.appointmentId, appointmentId))
  },

  async list(userId: string): Promise<Appointment[]> {
    return db.select()
      .from(appointments)
      .where(eq(appointments.userId, userId))
      .orderBy(desc(appointments.createdAt))
      .limit(200)
  },

  async findById(userId: string, id: string): Promise<Appointment | null> {
    const rows = await db.select()
      .from(appointments)
      .where(and(eq(appointments.userId, userId), eq(appointments.id, id)))
    return rows[0] ?? null
  },

  // Caută după referința publică (prg_xxxx) — folosită de comenzile owner pe WhatsApp (#6).
  async findByPublicRef(userId: string, publicRef: string): Promise<Appointment | null> {
    const rows = await db.select()
      .from(appointments)
      .where(and(eq(appointments.userId, userId), eq(appointments.publicRef, publicRef)))
    return rows[0] ?? null
  },

  // `scheduledAt`: dată+oră concretă setată de owner la confirmare (epoch ms). `undefined` = nu
  // o atinge (păstrează valoarea existentă); `null` = o golește explicit.
  async updateStatus(userId: string, id: string, status: 'pending' | 'confirmed' | 'completed' | 'cancelled', scheduledAt?: number | null): Promise<void> {
    const values: Partial<typeof appointments.$inferInsert> = { status, updatedAt: Date.now() }
    if (scheduledAt !== undefined) values.scheduledAt = scheduledAt
    await db.update(appointments)
      .set(values)
      .where(and(eq(appointments.userId, userId), eq(appointments.id, id)))
  },

  async delete(userId: string, id: string): Promise<void> {
    await db.delete(appointments)
      .where(and(eq(appointments.userId, userId), eq(appointments.id, id)))
  },

  // Ultimele programări ale unui contact — pentru detectarea dublurilor înainte de a crea una nouă.
  async listRecentForContact(userId: string, contactPhone: string, limit = 10): Promise<Appointment[]> {
    return db.select()
      .from(appointments)
      .where(and(eq(appointments.userId, userId), eq(appointments.contactPhone, contactPhone)))
      .orderBy(desc(appointments.createdAt))
      .limit(limit)
  },
}
