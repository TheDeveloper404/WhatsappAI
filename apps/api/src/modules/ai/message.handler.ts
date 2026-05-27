import type { WASocket } from '@whiskeysockets/baileys'
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { aiRepository } from './ai.repository.js'
import { askGroq, extractContactMemory, transcribeAudio, type GroqMessage } from './groq.client.js'
import { parseCommand, HELP_TEXT } from './command.parser.js'
import { recordOwnerReply, isOwnerActive } from './inactivity.tracker.js'
import { logger } from '../../utils/logger.js'
import type { AiSettings } from '../../db/schema.js'

function extractText(msg: any): string | null {
  const m = msg.message
  if (!m) return null
  const text = m.conversation
    || m.extendedTextMessage?.text
    || m.imageMessage?.caption
    || m.videoMessage?.caption
    || m.documentMessage?.caption
    || m.buttonsResponseMessage?.selectedDisplayText
    || m.listResponseMessage?.title
    || m.templateButtonReplyMessage?.selectedDisplayText
    || ''
  return text.trim() || null
}

function extractPhone(jid: string): string {
  return jid.split('@')[0].split(':')[0]
}

function isIndividualChat(jid: string): boolean {
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid')
}

export function detectSentiment(text: string): 'urgent' | 'frustrated' | 'normal' {
  const t = text.toLowerCase()
  const urgent = ['urgent', 'urgentă', 'urgenta', 'imediat', 'asap', 'grabă', 'graba', 'repede', 'acum']
  const frustrated = ['nemulțumit', 'nemultumit', 'supărat', 'suparat', 'dezamăgit', 'dezamagit', 'scandal', 'reclamație', 'reclamatie', 'nu merge', 'nu funcționează', 'nu functioneaza', 'îngrozitor', 'ingrozitor', 'catastrofă', 'catastrofa']
  if (urgent.some(k => t.includes(k)) || (text.match(/!{2,}/))) return 'urgent'
  if (frustrated.some(k => t.includes(k))) return 'frustrated'
  return 'normal'
}

// Mesaje programate: când owner e activ, le trimitem după ce expiră timer-ul
const pendingResponses = new Map<string, Map<string, NodeJS.Timeout>>()

function cancelPending(userId: string, contactPhone: string) {
  const t = pendingResponses.get(userId)?.get(contactPhone)
  if (t) {
    clearTimeout(t)
    pendingResponses.get(userId)!.delete(contactPhone)
  }
}

function schedulePending(userId: string, contactPhone: string, jid: string, sock: WASocket, settings: AiSettings, sentiment: 'urgent' | 'frustrated' | 'normal' = 'normal') {
  cancelPending(userId, contactPhone)
  const delayMs = settings.timerMinutes * 60 * 1000

  const timeout = setTimeout(async () => {
    pendingResponses.get(userId)?.delete(contactPhone)
    if (isOwnerActive(userId, contactPhone, settings.timerMinutes)) return
    try {
      await sendAiResponse(userId, contactPhone, jid, sock, settings, sentiment)
    } catch (err) {
      logger.error(`[AI][${userId.slice(0, 8)}] eroare răspuns programat`, { err: String(err) })
    }
  }, delayMs)

  if (!pendingResponses.has(userId)) pendingResponses.set(userId, new Map())
  pendingResponses.get(userId)!.set(contactPhone, timeout)
  logger.info(`[AI][${userId.slice(0, 8)}] răspuns programat`, { timerMin: settings.timerMinutes })
}

async function sendAiResponse(userId: string, contactPhone: string, jid: string, sock: WASocket, settings: AiSettings, sentiment: 'urgent' | 'frustrated' | 'normal' = 'normal'): Promise<void> {
  const [history, existingMemory] = await Promise.all([
    aiRepository.getContext(userId, contactPhone, 20),
    aiRepository.getContactMemory(userId, contactPhone),
  ])
  const ordered = [...history].reverse()

  let systemPrompt = settings.systemPrompt
  if (settings.writingStyle?.trim()) {
    systemPrompt += `\n\n---\n[Stilul tău de comunicare — respectă-l]\n${settings.writingStyle.trim()}`
  }
  if (settings.knowledgeBase?.trim()) {
    systemPrompt += `\n\n---\n[Servicii și informații despre business]\n${settings.knowledgeBase.trim()}`
  }
  if (existingMemory) {
    systemPrompt += `\n\n---\n[Context despre acest contact]\n${existingMemory}`
  }
  if (sentiment === 'urgent') {
    systemPrompt += `\n\n---\n[Atenție: clientul are o cerere urgentă. Răspunde direct, oferă soluție sau următor pas concret.]`
  } else if (sentiment === 'frustrated') {
    systemPrompt += `\n\n---\n[Atenție: clientul pare nemulțumit sau frustrat. Fii empatic, recunoaște problema și calmează situația.]`
  }

  const groqMessages: GroqMessage[] = [
    { role: 'system', content: systemPrompt },
    ...ordered.map(m => ({
      role: (m.fromMe ? 'assistant' : 'user') as 'assistant' | 'user',
      content: m.body,
    })),
  ]

  logger.info(`[AI][${userId.slice(0, 8)}] generez răspuns`)
  const reply = await askGroq(groqMessages)
  await sock.sendMessage(jid, { text: reply })
  await aiRepository.saveMessage(userId, contactPhone, true, reply, Date.now())
  logger.info(`[AI][${userId.slice(0, 8)}] răspuns trimis`)

  // Actualizează memoria în background, fără să blocheze răspunsul
  const messagesForMemory = [...ordered, { fromMe: true, body: reply }]
  extractContactMemory(existingMemory, messagesForMemory)
    .then(summary => aiRepository.upsertContactMemory(userId, contactPhone, summary))
    .catch(err => logger.error(`[AI][${userId.slice(0, 8)}] eroare actualizare memorie`, { err: String(err) }))
}

export async function handleMessages(userId: string, sock: WASocket, messages: any[]): Promise<void> {
  for (const msg of messages) {
    try {
      await processMessage(userId, sock, msg)
    } catch (err) {
      logger.error(`[AI][${userId.slice(0, 8)}] eroare procesare mesaj`, { err: String(err) })
    }
  }
}

async function processMessage(userId: string, sock: WASocket, msg: any): Promise<void> {
  const jid: string = msg.key?.remoteJid
  if (!jid || !isIndividualChat(jid)) return

  const fromMe: boolean = msg.key?.fromMe ?? false
  const contactPhone = extractPhone(jid)
  const waTimestamp = (msg.messageTimestamp as number) * 1000
  logger.info(`[AI][${userId.slice(0, 8)}] procesez mesaj`, { fromMe, contactPhone })

  const m = msg.message
  const isAudio = !fromMe && (m?.audioMessage || m?.pttMessage)

  let body: string | null = null

  if (isAudio) {
    try {
      const buffer = await downloadMediaMessage(msg, 'buffer', {}) as Buffer
      const mimeType = m?.audioMessage?.mimetype ?? m?.pttMessage?.mimetype ?? 'audio/ogg'
      body = await transcribeAudio(buffer, mimeType)
      logger.info(`[AI][${userId.slice(0, 8)}] vocal transcris`)
    } catch (err) {
      logger.error(`[AI][${userId.slice(0, 8)}] eroare transcriere vocal`, { err: String(err) })
      return
    }
  } else {
    body = extractText(msg)
  }

  if (!body) return

  await aiRepository.saveMessage(userId, contactPhone, fromMe, body, waTimestamp)

  if (fromMe) {
    cancelPending(userId, contactPhone)
    recordOwnerReply(userId, contactPhone)

    const cmd = parseCommand(body)
    if (!cmd) {
      if (body.startsWith('/')) {
        await sock.sendMessage(jid, { text: `❓ Comandă necunoscută sau parametru lipsă.\n\nTrimite */help* pentru lista comenzilor.` })
      }
      return
    }
    await executeCommand(userId, sock, jid, contactPhone, cmd)
    return
  }

  const settings = await aiRepository.getSettings(userId)
  if (!settings.isActive) {
    logger.info(`[AI][${userId.slice(0, 8)}] agent inactiv (isActive=false)`)
    return
  }
  if (settings.adminDisabled) {
    logger.info(`[AI][${userId.slice(0, 8)}] agent dezactivat de admin`)
    return
  }
  if (settings.pauseUntil && Date.now() < settings.pauseUntil) {
    logger.info(`[AI][${userId.slice(0, 8)}] agent în pauză`)
    return
  }
  if (await aiRepository.isBlacklisted(userId, contactPhone)) return

  const sentiment = detectSentiment(body)

  if (isOwnerActive(userId, contactPhone, settings.timerMinutes)) {
    schedulePending(userId, contactPhone, jid, sock, settings, sentiment)
    return
  }

  await sendAiResponse(userId, contactPhone, jid, sock, settings, sentiment)
}

async function executeCommand(userId: string, sock: WASocket, jid: string, contactPhone: string, cmd: ReturnType<typeof parseCommand>): Promise<void> {
  if (!cmd) return

  let reply = ''

  switch (cmd.type) {
    case 'activateAI': {
      const current = await aiRepository.getSettings(userId)
      if (current.adminDisabled) {
        reply = '🔒 Agentul a fost dezactivat de administrator. Contactează suportul pentru reactivare.'
        break
      }
      await aiRepository.updateSettings(userId, { isActive: true, pauseUntil: null })
      reply = '✅ Agentul AI a fost *activat*.'
      break
    }

    case 'deactivateAI':
      await aiRepository.updateSettings(userId, { isActive: false, pauseUntil: null })
      reply = '⛔ Agentul AI a fost *dezactivat*.'
      break

    case 'pauseAI':
      await aiRepository.updateSettings(userId, { pauseUntil: Date.now() + cmd.hours * 3_600_000 })
      reply = `⏸️ Agentul AI este în pauză pentru *${cmd.hours}h*.`
      break

    case 'skipAI':
      await aiRepository.addBlacklist(userId, cmd.phone)
      reply = `🚫 Contactul *${cmd.phone}* a fost adăugat pe lista de ignorat.`
      break

    case 'unskipAI':
      await aiRepository.removeBlacklist(userId, cmd.phone)
      reply = `✅ Contactul *${cmd.phone}* a fost scos de pe lista de ignorat.`
      break

    case 'status': {
      const s = await aiRepository.getSettings(userId)
      const paused = s.pauseUntil && Date.now() < s.pauseUntil
        ? `⏸️ Pauză până la ${new Date(s.pauseUntil).toLocaleTimeString('ro-RO')}`
        : null
      reply = `*Status Agent AI*\n` +
        `Stare: ${s.isActive ? '✅ Activ' : '⛔ Inactiv'}${paused ? `\n${paused}` : ''}\n` +
        `Timer inactivitate: ${s.timerMinutes} min`
      break
    }

    case 'setTimer':
      await aiRepository.updateSettings(userId, { timerMinutes: cmd.minutes })
      reply = `⏱️ Timer inactivitate setat la *${cmd.minutes} min*.`
      break

    case 'clearHistory':
      await aiRepository.clearHistoryForChat(userId, contactPhone, jid)
      reply = `🗑️ Istoricul conversației curente a fost șters.`
      break

    case 'help':
      reply = HELP_TEXT
      break
  }

  if (reply) await sock.sendMessage(jid, { text: reply })
}
