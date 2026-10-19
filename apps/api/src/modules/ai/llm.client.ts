import { env } from '../../config/env.js'
import { logger } from '../../utils/logger.js'

// Client LLM unic: OpenRouter, API OpenAI-compatible (POST /chat/completions).
// Modelul vine din LLM_MODEL (ex. `google/gemini-2.5-flash`, `anthropic/claude-sonnet-4.5`);
// opțional LLM_FALLBACK_MODEL e încercat dacă primul apel eșuează.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const REQUEST_TIMEOUT_MS = 45_000

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }
type LLMOptions = { maxTokens?: number; temperature?: number }

async function callOpenRouter(model: string, messages: ChatMessage[], options?: LLMOptions): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      // Headere opționale de atribuire a aplicației în dashboard-ul OpenRouter.
      'X-Title': 'WhatsApp AI (personal)',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options?.maxTokens ?? 600,
      temperature: options?.temperature ?? 0.7,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!res.ok) {
    // Corpul erorii poate conține ecoul promptului la unii provideri → trunchiat, fără PII în log.
    const text = (await res.text()).slice(0, 300)
    throw new Error(`OpenRouter ${res.status} (${model}): ${text}`)
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string | null } }>
    error?: { message?: string }
  }
  if (data.error) throw new Error(`OpenRouter error (${model}): ${data.error.message ?? 'unknown'}`)
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error(`OpenRouter (${model}): răspuns gol`)
  }
  return content.trim()
}

export async function chat(messages: ChatMessage[], options?: LLMOptions): Promise<string> {
  try {
    return await callOpenRouter(env.LLM_MODEL, messages, options)
  } catch (err) {
    if (!env.LLM_FALLBACK_MODEL) throw err
    logger.warn('[LLM] modelul primar a eșuat — încerc fallback', { model: env.LLM_MODEL, fallback: env.LLM_FALLBACK_MODEL })
    return callOpenRouter(env.LLM_FALLBACK_MODEL, messages, options)
  }
}

export const isTranscriptionEnabled = Boolean(env.GROQ_API_KEY)

// Transcriere vocală (Groq Whisper). Apelată doar când GROQ_API_KEY e setat.
export async function transcribeAudio(buffer: Buffer, mimeType = 'audio/ogg'): Promise<string> {
  if (!env.GROQ_API_KEY) throw new Error('GROQ_API_KEY nesetat — transcrierea e dezactivată')
  const formData = new FormData()
  formData.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), 'audio.ogg')
  formData.append('model', 'whisper-large-v3')
  formData.append('response_format', 'json')

  const res = await fetch(GROQ_WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: formData,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Groq Whisper error ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json() as { text: string }
  return data.text.trim()
}

export async function extractWritingStyle(ownerMessages: string[]): Promise<string> {
  const sample = ownerMessages.slice(0, 60).join('\n')
  const prompt = `Analizează stilul de scriere al unei persoane pe baza mesajelor ei de WhatsApp.

Mesaje:
${sample}

Descrie stilul în 3-5 propoziții concise, acoperind:
- Ton (formal/informal, cald/distant)
- Lungimea tipică a mesajelor
- Formule de salut/rămas bun folosite
- Folosirea emoji-urilor sau a punctuației speciale
- Expresii sau cuvinte caracteristice

Returnează doar descrierea stilului, fără introducere.`

  return chat([{ role: 'user', content: prompt }], { maxTokens: 400, temperature: 0.3 })
}

export async function extractContactMemory(
  existingSummary: string | null,
  messages: Array<{ fromMe: boolean; body: string }>,
): Promise<string> {
  const convoText = messages
    .map(m => `${m.fromMe ? 'Owner' : 'Contact'}: ${m.body}`)
    .join('\n')

  const prompt = `You are a memory extractor for a WhatsApp assistant.

Extract key facts about the CONTACT (not the owner) from this conversation.
Focus on: name (if mentioned), what they want or need, job or city (if mentioned), relationship stage, any preferences or important context.

Current known info: ${existingSummary ?? 'None'}

Recent conversation:
${convoText}

Return a concise updated summary (2-3 sentences max). Only include facts explicitly stated. If nothing new to add, return the current known info unchanged. Never invent facts.`

  return chat([{ role: 'user', content: prompt }], { maxTokens: 250, temperature: 0.3 })
}
