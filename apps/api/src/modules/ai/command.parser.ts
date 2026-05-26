export type ParsedCommand =
  | { type: 'activateAI' }
  | { type: 'deactivateAI' }
  | { type: 'pauseAI'; hours: number }
  | { type: 'skipAI'; phone: string }
  | { type: 'unskipAI'; phone: string }
  | { type: 'status' }
  | { type: 'help' }
  | { type: 'setTimer'; minutes: number }
  | { type: 'clearHistory' }

export function parseCommand(body: string): ParsedCommand | null {
  const trimmed = body.trim()
  if (!trimmed.startsWith('/')) return null

  const parts = trimmed.split(/\s+/)
  const cmd = parts[0].toLowerCase()

  if (cmd === '/activateai') return { type: 'activateAI' }
  if (cmd === '/deactivateai') return { type: 'deactivateAI' }
  if (cmd === '/resumeai') return { type: 'activateAI' }
  if (cmd === '/status') return { type: 'status' }
  if (cmd === '/help') return { type: 'help' }

  if (cmd === '/pauseai') {
    const arg = parts[1] ?? ''
    const match = arg.match(/^(\d+)h$/i)
    const hours = match ? parseInt(match[1]) : 1
    return { type: 'pauseAI', hours }
  }

  if (cmd === '/skipai') {
    const phone = parts[1]?.replace(/[^0-9]/g, '') ?? ''
    if (!phone) return null
    return { type: 'skipAI', phone }
  }

  if (cmd === '/unskipai') {
    const phone = parts[1]?.replace(/[^0-9]/g, '') ?? ''
    if (!phone) return null
    return { type: 'unskipAI', phone }
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
/skipAI +40758... — ignoră un contact
/unskipAI +40758... — re-activează contact
/clearHistory — șterge istoricul conversației curente
/status — stare curentă agent`
