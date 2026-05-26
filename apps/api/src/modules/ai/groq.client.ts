import { env } from '../../config/env.js'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'

export type GroqMessage = { role: 'system' | 'user' | 'assistant'; content: string }

async function callGroq(messages: GroqMessage[], options?: { max_tokens?: number; temperature?: number }): Promise<string> {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: options?.max_tokens ?? 300,
      temperature: options?.temperature ?? 0.8,
      frequency_penalty: 0.5,
      presence_penalty: 0.4,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Groq API error ${res.status}: ${text}`)
  }

  const data = await res.json() as any
  return (data.choices[0].message.content as string).trim()
}

export async function askGroq(messages: GroqMessage[]): Promise<string> {
  return callGroq(messages)
}

export async function transcribeAudio(buffer: Buffer, mimeType = 'audio/ogg'): Promise<string> {
  const formData = new FormData()
  formData.append('file', new Blob([buffer], { type: mimeType }), 'audio.ogg')
  formData.append('model', 'whisper-large-v3')
  formData.append('response_format', 'json')

  const res = await fetch(GROQ_WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: formData,
  })
  if (!res.ok) throw new Error(`Groq Whisper error ${res.status}: ${await res.text()}`)
  const data = await res.json() as { text: string }
  return data.text.trim()
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

  return callGroq([{ role: 'user', content: prompt }], { max_tokens: 250, temperature: 0.3 })
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

  return callGroq(
    [{ role: 'user', content: prompt }],
    { max_tokens: 150, temperature: 0.3 },
  )
}
