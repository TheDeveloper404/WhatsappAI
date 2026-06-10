export type ParsedCommand =
  | { type: 'activateAI' }
  | { type: 'deactivateAI' }
  | { type: 'pauseAI'; hours: number }
  | { type: 'status' }
  | { type: 'help' }
  | { type: 'setTimer'; minutes: number }
  | { type: 'clearHistory' }
  | { type: 'confirmBooking'; ref: string }
  | { type: 'cancelBooking'; ref: string }
  | { type: 'completeBooking'; ref: string }

// Comenzi owner de gestionare a programărilor (#6). Numele fără diacritice; le tolerăm oricum
// (normalizăm NFD) ca „/confirmă" să meargă la fel ca „/confirma".
const BOOKING_COMMANDS: Record<string, 'confirmBooking' | 'cancelBooking' | 'completeBooking'> = {
  '/confirma': 'confirmBooking',
  '/anuleaza': 'cancelBooking',
  '/finalizeaza': 'completeBooking',
}

export function parseCommand(body: string): ParsedCommand | null {
  const trimmed = body.trim()
  if (!trimmed.startsWith('/')) return null

  const parts = trimmed.split(/\s+/)
  // Lowercase + elimină diacriticele din numele comenzii (ă→a, ț→t etc.).
  const cmd = parts[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  const bookingType = BOOKING_COMMANDS[cmd]
  if (bookingType) {
    const ref = (parts[1] ?? '').trim()
    if (!/^prg_[a-z0-9]+$/i.test(ref)) return null
    return { type: bookingType, ref }
  }

  if (cmd === '/activateai') return { type: 'activateAI' }
  if (cmd === '/deactivateai') return { type: 'deactivateAI' }
  if (cmd === '/resumeai') return { type: 'activateAI' }
  if (cmd === '/status') return { type: 'status' }
  if (cmd === '/help') return { type: 'help' }

  if (cmd === '/pauseai') {
    const arg = parts[1] ?? ''
    // Acceptă „2h" sau „2". Plafon 1–720h (~30 zile): 0/lipsă/invalid → 1h, peste plafon → 720h.
    // Evită pauze accidentale de ani (fără plafon, „/pauseai 99999h" oprea agentul ~11 ani).
    const match = arg.match(/^(\d+)h?$/i)
    const raw = match ? parseInt(match[1]) : 1
    const hours = Math.min(Math.max(raw, 1), 720)
    return { type: 'pauseAI', hours }
  }

  if (cmd === '/clearhistory') {
    return { type: 'clearHistory' }
  }

  if (cmd === '/settimer') {
    const arg = parts[1] ?? ''
    const match = arg.match(/^(\d+)(?:min)?$/i)
    const minutes = match ? parseInt(match[1]) : null
    if (!minutes || minutes < 1 || minutes > 60) return null
    return { type: 'setTimer', minutes }
  }

  return null
}

export const HELP_TEXT = `*Comenzi WhatsApp AI:*
/activateAI — activează agentul
/deactivateAI — dezactivează agentul
/pauseAI 2h — pauză X ore
/resumeAI — scoate din pauză
/setTimer 5min — timer inactivitate (1-60 min)
/clearHistory — șterge istoricul conversației curente
/status — stare curentă agent

*Programări:*
/confirma prg_xxxxxx — confirmă o programare (anunță clientul)
/anuleaza prg_xxxxxx — anulează o programare (anunță clientul)
/finalizeaza prg_xxxxxx — marchează programarea ca finalizată`
