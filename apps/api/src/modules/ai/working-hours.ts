// Program de funcționare per business — sursă de adevăr pentru validarea sloturilor de programare (0.5.3).
// Filozofia proiectului: AI-ul EXTRAGE slotul (zi+oră), validarea se face DETERMINIST aici, în cod.
// NU mutăm logica de program în prompt. Stocat ca JSON serializat în `ai_settings.working_hours`.
// Gol/corupt la citire = neconfigurat → fail-open (nu validăm nimic, comportament ca înainte).

const TZ = 'Europe/Bucharest'

// Ordinea zilelor (luni-first, ca în RO). Cheile sunt stabile — folosite și ca chei JSON în DB.
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Weekday = (typeof WEEKDAYS)[number]

// Etichete RO pentru afișare (prompt + mesaj de guard către client).
const WEEKDAY_RO: Record<Weekday, string> = {
  mon: 'Luni', tue: 'Marți', wed: 'Miercuri', thu: 'Joi', fri: 'Vineri', sat: 'Sâmbătă', sun: 'Duminică',
}

// Un interval deschis dintr-o zi, „HH:MM"–„HH:MM". Fără pauză de prânz (YAGNI — vezi B6 pentru extindere).
export type DayHours = { open: string; close: string }
// null sau cheie lipsă = zi închisă.
export type WorkingHours = Partial<Record<Weekday, DayHours | null>>

// „HH:MM" (00:00–23:59) → minute de la miezul nopții. null = format invalid.
function timeToMinutes(hhmm: unknown): number | null {
  if (typeof hhmm !== 'string') return null
  const m = hhmm.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (!m) return null
  return +m[1] * 60 + +m[2]
}

function minutesToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

// Validare STRICTĂ a unei structuri de program venită de la client (route/service la save).
// Aruncă Error cu mesaj clar în română dacă e invalidă. Normalizează „HH:MM" (zero-padding).
export function validateWorkingHours(input: unknown): WorkingHours {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Program invalid: se așteaptă un obiect cu zilele săptămânii.')
  }
  const out: WorkingHours = {}
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!WEEKDAYS.includes(key as Weekday)) {
      throw new Error(`Program invalid: zi necunoscută „${key}".`)
    }
    const day = key as Weekday
    if (raw == null) { out[day] = null; continue } // zi închisă
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`Program invalid pentru ${WEEKDAY_RO[day]}: se așteaptă { open, close } sau null.`)
    }
    const { open, close } = raw as { open?: unknown; close?: unknown }
    const openMin = timeToMinutes(open)
    const closeMin = timeToMinutes(close)
    if (openMin == null || closeMin == null) {
      throw new Error(`Program invalid pentru ${WEEKDAY_RO[day]}: orele trebuie în format HH:MM.`)
    }
    if (openMin >= closeMin) {
      throw new Error(`Program invalid pentru ${WEEKDAY_RO[day]}: ora de deschidere trebuie să fie înainte de cea de închidere.`)
    }
    out[day] = { open: minutesToTime(openMin), close: minutesToTime(closeMin) }
  }
  return out
}

// Serializare pentru DB. Obiect gol → '' (neconfigurat).
export function serializeWorkingHours(wh: WorkingHours): string {
  return Object.keys(wh).length === 0 ? '' : JSON.stringify(wh)
}

// Citire TOLERANTĂ din DB. Gol/JSON corupt/structură invalidă → null (neconfigurat → fail-open).
// Nu aruncă niciodată: validarea strictă s-a făcut la save; aici nu blocăm răspunsul agentului.
export function parseWorkingHours(raw: string | null | undefined): WorkingHours | null {
  if (!raw || !raw.trim()) return null
  try {
    const wh = validateWorkingHours(JSON.parse(raw))
    return Object.keys(wh).length === 0 ? null : wh
  } catch {
    return null
  }
}

export type SlotCheck =
  | { ok: true }
  | { ok: false; reason: 'closed_day' | 'outside_hours'; day: Weekday }

// Sursa de adevăr a guard-ului 0.5.3: validează un slot normalizat (zi a săptămânii + oră „HH:MM")
// față de program. Programul e recurent pe zi, deci (weekday, time) e suficient — nu ne trebuie data
// absolută. Fail-open: program neconfigurat SAU oră ne-parsabilă → ok (nu blocăm). Apelantul tratează
// doar `ok:false`. Owner-ul rămâne autoritatea pe oră (nu validăm ce setează el manual la confirmare).
export function checkWeekdayTime(wh: WorkingHours | null, weekday: Weekday, time: string): SlotCheck {
  if (!wh) return { ok: true }
  const minutes = timeToMinutes(time)
  if (minutes == null) return { ok: true }
  const hours = wh[weekday]
  if (!hours) return { ok: false, reason: 'closed_day', day: weekday }
  const openMin = timeToMinutes(hours.open)!
  const closeMin = timeToMinutes(hours.close)!
  if (minutes < openMin || minutes >= closeMin) return { ok: false, reason: 'outside_hours', day: weekday }
  return { ok: true }
}

// Descriere RO a programului unei zile, pentru mesajul către client („Sâmbătă lucrăm 09:00–13:00"
// / „Sâmbătă este zi închisă"). Folosit de guard la respingerea unui slot invalid.
export function describeDayRo(wh: WorkingHours, weekday: Weekday): string {
  const h = wh[weekday]
  return h
    ? `${WEEKDAY_RO[weekday]} lucrăm ${h.open}–${h.close}`
    : `${WEEKDAY_RO[weekday]} este zi închisă`
}

// Text RO pe linii, pentru injectare în prompt și pentru mesajul de guard către client.
// Ex: „Luni: 09:00–18:00\n…\nDuminică: închis". Null/gol → '' (apelantul decide ce face).
export function formatWorkingHoursRo(wh: WorkingHours | null): string {
  if (!wh) return ''
  return WEEKDAYS.map(d => {
    const h = wh[d]
    return `${WEEKDAY_RO[d]}: ${h ? `${h.open}–${h.close}` : 'închis'}`
  }).join('\n')
}
