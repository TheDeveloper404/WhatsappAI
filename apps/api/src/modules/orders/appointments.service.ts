import { appointmentsRepository } from './appointments.repository.js'
import { sendToContact } from '../whatsapp/whatsapp.session-manager.js'
import { logger } from '../../utils/logger.js'
import type { Appointment } from '../../db/schema.js'

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

// Schimbă statusul unei programări ȘI notifică clientul pe WhatsApp la TRANZIȚIE reală de status.
// Sursă UNICĂ de adevăr, folosită de: dashboard (PATCH /:id/status) și comenzile owner pe WhatsApp (#6).
// Text fix, în cod. Fail-soft: dacă WhatsApp nu e conectat, statusul tot se salvează în DB.
export async function setAppointmentStatus(
  userId: string,
  existing: Appointment,
  newStatus: AppointmentStatus,
): Promise<{ changed: boolean; notified: boolean }> {
  const changed = newStatus !== existing.status
  await appointmentsRepository.updateStatus(userId, existing.id, newStatus)

  if (!changed) return { changed: false, notified: false }

  const slot = existing.requestedSlot.trim() ? ` (${existing.requestedSlot.trim()})` : ''
  const messages: Record<AppointmentStatus, string | null> = {
    pending: null,
    confirmed: `✅ Programarea ta pentru „${existing.serviceName}"${slot} a fost confirmată! Te așteptăm.`,
    completed: `🎉 Mulțumim că ai trecut pe la noi! Te mai așteptăm.`,
    cancelled: `ℹ️ Programarea ta pentru „${existing.serviceName}"${slot} a fost anulată. Scrie-ne dacă vrei altă dată.`,
  }
  const message = messages[newStatus]
  if (!message) return { changed: true, notified: false }

  try {
    const notified = await sendToContact(userId, existing.contactPhone, message)
    return { changed: true, notified }
  } catch (err) {
    logger.error(`[appointments] notificare status eșuată`, { err: String(err) })
    return { changed: true, notified: false }
  }
}
