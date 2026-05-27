import { env } from '../../config/env.js'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export type GeminiMessage = { role: 'system' | 'user' | 'assistant'; content: string }

async function callGemini(messages: GeminiMessage[], options?: { max_tokens?: number; temperature?: number }): Promise<string> {
  const systemMsg = messages.find(m => m.role === 'system')
  const conversationMsgs = messages.filter(m => m.role !== 'system')

  const body: Record<string, unknown> = {
    contents: conversationMsgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: options?.max_tokens ?? 300,
      temperature: options?.temperature ?? 0.8,
    },
  }

  if (systemMsg) {
    body.system_instruction = { parts: [{ text: systemMsg.content }] }
  }

  const res = await fetch(`${GEMINI_API_URL}?key=${env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${text}`)
  }

  const data = await res.json() as any
  const candidate = data.candidates?.[0]
  if (!candidate) throw new Error('Gemini: no candidates returned')
  return (candidate.content.parts[0].text as string).trim()
}

export async function askGemini(messages: GeminiMessage[]): Promise<string> {
  return callGemini(messages)
}

export async function extractWritingStyle(ownerMessages: string[]): Promise<string> {
  const sample = ownerMessages.slice(0, 60).join('\n')
  const prompt = `Analizează stilul de scriere al unui antreprenor pe baza mesajelor lui de WhatsApp.

Mesaje:
${sample}

Descrie stilul în 3-5 propoziții concise, acoperind:
- Ton (formal/informal, cald/distant)
- Lungimea tipică a mesajelor
- Formule de salut/rămas bun folosite
- Folosirea emoji-urilor sau a punctuației speciale
- Expresii sau cuvinte caracteristice

Returnează doar descrierea stilului, fără introducere.`

  return callGemini([{ role: 'user', content: prompt }], { max_tokens: 250, temperature: 0.3 })
}

export async function extractContactMemory(
  existingSummary: string | null,
  messages: Array<{ fromMe: boolean; body: string }>,
): Promise<string> {
  const convoText = messages
    .map(m => `${m.fromMe ? 'Owner' : 'Contact'}: ${m.body}`)
    .join('\n')

  const prompt = `You are a memory extractor for a WhatsApp business assistant.

Extract key facts about the CONTACT (not the owner) from this conversation.
Focus on: name (if mentioned), what they want or need, job or city (if mentioned), relationship stage, any preferences or important context.

Current known info: ${existingSummary ?? 'None'}

Recent conversation:
${convoText}

Return a concise updated summary (2-3 sentences max). Only include facts explicitly stated. If nothing new to add, return the current known info unchanged. Never invent facts.`

  return callGemini(
    [{ role: 'user', content: prompt }],
    { max_tokens: 150, temperature: 0.3 },
  )
}
