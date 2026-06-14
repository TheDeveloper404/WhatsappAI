import { appointmentsRepository } from './appointments.repository.js'
import { sendToContact } from '../whatsapp/whatsapp.session-manager.js'
import { logger } from '../../utils/logger.js'
import type { Appointment } from '../../db/schema.js'

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

const TZ = 'Europe/Bucharest'

// Formatează o dată+oră (epoch ms) în text clar în română, ora României: „joi, 18 iunie, ora 09:00".
// Owner-ul e autoritatea pe oră (la fel ca la prețuri AI-ul nu inventează ore) → afișăm exact ce a pus el.
function formatSlotRo(ts: number): string {
  const d = new Date(ts)
  const day = new Intl.DateTimeFormat('ro-RO', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(d)
  const time = new Intl.DateTimeFormat('ro-RO', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${day}, ora ${time}`
}

// Offset-ul (minute) al Europe/Bucharest pentru un moment dat — via Intl, fără librărie de tz.
function bucharestOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const g = (t: string) => Number(parts.find(p => p.type === t)?.value)
  const asUTC = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second'))
  return Math.round((asUTC - utcMs) / 60000)
}

// Parsează „ZZ.LL HH:MM" (sau „ZZ.LL.AAAA HH:MM"; separatori . / -) → epoch ms, interpretat ca ora
// României. STRICT (nu limbaj natural) ca să fie fiabil pe calea de comandă WhatsApp. NULL = invalid.
export function parseSlotToEpoch(text: string, now: number = Date.now()): number | null {
  const m = text.trim().match(/^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?\s+(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const day = +m[1], month = +m[2], hour = +m[4], minute = +m[5]
  let year = m[3] ? +m[3] : new Date(now).getFullYear()
  if (year < 100) year += 2000
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null
  // Wall-clock RO → epoch: aplică offset-ul Bucharest pentru momentul respectiv.
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute)
  const ts = utcGuess - bucharestOffsetMinutes(utcGuess) * 60000
  // Respinge date imposibile (ex. 31.02 normalizat de Date.UTC): verifică ziua/luna la round-trip.
  const back = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts))
  if (back !== `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`) return null
  return ts
}

// Schimbă statusul unei programări ȘI notifică clientul pe WhatsApp la TRANZIȚIE reală de status.
// Sursă UNICĂ de adevăr, folosită de: dashboard (PATCH /:id/status) și comenzile owner pe WhatsApp (#6).
// `scheduledAt` (epoch ms) = ora concretă pe care owner-ul o setează la confirmare; intră în mesaj.
// Text fix, în cod. Fail-soft: dacă WhatsApp nu e conectat, statusul tot se salvează în DB.
export async function setAppointmentStatus(
  userId: string,
  existing: Appointment,
  newStatus: AppointmentStatus,
  scheduledAt?: number,
): Promise<{ changed: boolean; notified: boolean }> {
  const changed = newStatus !== existing.status
  // Ora concretă se setează doar la confirmare; pe alte tranziții n-o atingem (undefined).
  await appointmentsRepository.updateStatus(userId, existing.id, newStatus, newStatus === 'confirmed' ? scheduledAt : undefined)

  if (!changed) return { changed: false, notified: false }

  // Folosim ora tocmai setată sau, dacă nu s-a dat acum, cea deja salvată. NU mai repetăm
  // `requestedSlot` (preferința vagă a clientului) ca și cum ar fi ora confirmată — ăsta era bug-ul.
  const when = scheduledAt ?? existing.scheduledAt ?? null
  const whenText = when != null ? `: ${formatSlotRo(when)}` : ''
  const messages: Record<AppointmentStatus, string | null> = {
    pending: null,
    confirmed: `✅ Programarea ta pentru „${existing.serviceName}" e confirmată${whenText}. Te așteptăm!`,
    completed: `🎉 Mulțumim că ai trecut pe la noi! Te mai așteptăm.`,
    cancelled: `ℹ️ Programarea ta pentru „${existing.serviceName}" a fost anulată. Scrie-ne dacă vrei altă dată.`,
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
