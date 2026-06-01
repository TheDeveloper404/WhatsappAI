import { randomUUID } from 'crypto'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../../config/database.js'
import { appointments } from '../../db/schema.js'
import type { Appointment } from '../../db/schema.js'

// Referință scurtă lizibilă pentru programare (ex. „prg_a1b2c3"). Doar hex → fără caractere ambigue.
function genPublicRef(): string {
  return 'prg_' + randomUUID().replace(/-/g, '').slice(0, 6)
}

export type AppointmentInput = {
  serviceName: string
  requestedSlot: string
  details: string
}

export const appointmentsRepository = {
  // Creează o programare 'pending'. Nimic nu trece prin LLM ca decizie finală — owner-ul confirmă.
  async create(userId: string, contactPhone: string, data: AppointmentInput): Promise<Appointment> {
    const now = Date.now()
    const appointment = {
      id: randomUUID(),
      publicRef: genPublicRef(),
      userId,
      contactPhone,
      status: 'pending' as const,
      serviceName: data.serviceName,
      requestedSlot: data.requestedSlot,
      details: data.details,
      createdAt: now,
      updatedAt: now,
    }
    await db.insert(appointments).values(appointment)
    return appointment
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

  async updateStatus(userId: string, id: string, status: 'pending' | 'confirmed' | 'completed' | 'cancelled'): Promise<void> {
    await db.update(appointments)
      .set({ status, updatedAt: Date.now() })
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
