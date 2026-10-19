export type ParsedCommand =
  | { type: 'activateAI' }
  | { type: 'deactivateAI' }
  | { type: 'pauseAI'; hours: number }
  | { type: 'status' }
  | { type: 'help' }
  | { type: 'setTimer'; minutes: number }
  | { type: 'clearHistory' }
  | { type: 'block'; phone?: string }
  | { type: 'unblock'; phone?: string }
  | { type: 'kb'; action: 'show' }
  | { type: 'kb'; action: 'clear' }
  | { type: 'kb'; action: 'set'; text: string }
  | { type: 'kb'; action: 'add'; text: string }
  | { type: 'prompt'; action: 'show' }
  | { type: 'prompt'; action: 'reset' }
  | { type: 'prompt'; action: 'set'; text: string }
  | { type: 'learnStyle' }
  | { type: 'notify'; enabled: boolean }

// Plafon pentru textele lungi setate din WhatsApp (KB / prompt) — protejează contextul LLM.
export const MAX_KB_CHARS = 30_000
export const MAX_PROMPT_CHARS = 8_000

export function parseCommand(body: string): ParsedCommand | null {
  const trimmed = body.trim()
  if (!trimmed.startsWith('/')) return null

  const parts = trimmed.split(/\s+/)
  const cmd = parts[0].toLowerCase()
  // Restul mesajului după comandă și sub-comandă, cu newline-urile păstrate (pt. /kb, /prompt).
  const restAfter = (n: number) => {
    let rest = trimmed
    for (let i = 0; i < n; i++) rest = rest.replace(/^\S+\s*/, '')
    return rest.trim()
  }

  if (cmd === '/activateai') return { type: 'activateAI' }
  if (cmd === '/deactivateai') return { type: 'deactivateAI' }
  if (cmd === '/resumeai') return { type: 'activateAI' }
  if (cmd === '/status') return { type: 'status' }
  if (cmd === '/help') return { type: 'help' }
  if (cmd === '/block' || cmd === '/unblock') {
    const type = cmd === '/block' ? 'block' : 'unblock'
    const arg = restAfter(1)
    if (!arg) return { type }
    // „+40 722 123 456", „0722-123-456" → „40722123456". Număr RO local (07...) → prefix 40.
    let phone = arg.replace(/\D/g, '')
    if (/^07\d{8}$/.test(phone)) phone = `4${phone}`
    if (!/^\d{8,15}$/.test(phone)) return null
    return { type, phone }
  }
  if (cmd === '/learnstyle') return { type: 'learnStyle' }

  if (cmd === '/notify') {
    const arg = (parts[1] ?? '').toLowerCase()
    if (arg === 'on') return { type: 'notify', enabled: true }
    if (arg === 'off') return { type: 'notify', enabled: false }
    return null
  }

  if (cmd === '/pauseai') {
    const arg = parts[1] ?? ''
    // Acceptă „2h" sau „2". Plafon 1–720h (~30 zile): 0/lipsă/invalid → 1h, peste plafon → 720h.
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

  if (cmd === '/kb') {
    const sub = (parts[1] ?? '').toLowerCase()
    if (sub === '' || sub === 'show') return { type: 'kb', action: 'show' }
    if (sub === 'clear') return { type: 'kb', action: 'clear' }
    if (sub === 'set' || sub === 'add') {
      const text = restAfter(2)
      if (!text) return null
      return sub === 'set' ? { type: 'kb', action: 'set', text } : { type: 'kb', action: 'add', text }
    }
    return null
  }

  if (cmd === '/prompt') {
    const sub = (parts[1] ?? '').toLowerCase()
    if (sub === '' || sub === 'show') return { type: 'prompt', action: 'show' }
    if (sub === 'reset') return { type: 'prompt', action: 'reset' }
    if (sub === 'set') {
      const text = restAfter(2)
      if (!text) return null
      return { type: 'prompt', action: 'set', text }
    }
    return null
  }

  return null
}

export const HELP_TEXT = `*Comenzi agent AI:*
/activateAI — activează agentul
/deactivateAI — dezactivează agentul
/pauseAI 2h — pauză X ore (max 720)
/resumeAI — scoate din pauză
/setTimer 5 — minute de inactivitate până răspunde AI-ul (1–60)
/status — stare curentă
/notify on|off — notificări „AI a preluat conversația”

*În chatul unui contact:*
/clearHistory — șterge istoricul conversației curente
/block — AI-ul nu mai răspunde acestui contact
/unblock — reactivează AI-ul pentru acest contact

*Doar în chatul cu tine („Tu"):*
/kb — arată knowledge base
/kb set <text> — înlocuiește knowledge base
/kb add <text> — adaugă la knowledge base
/kb clear — golește knowledge base
/prompt — arată promptul
/prompt set <text> — setează promptul
/prompt reset — revine la promptul implicit
/learnStyle — învață stilul tău din mesajele trimise
/block 0722123456 — AI-ul nu mai răspunde numărului dat
/unblock 0722123456 — reactivează AI-ul pentru numărul dat`
