import { env } from '../../config/env.js'
import { logger } from '../../utils/logger.js'

// Client LLM unic: OpenRouter, API OpenAI-compatible (POST /chat/completions).
// Modelul vine din LLM_MODEL (ex. `google/gemini-2.5-flash`, `anthropic/claude-sonnet-4.5`);
// opțional LLM_FALLBACK_MODEL e încercat dacă primul apel eșuează.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 45_000

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }
type LLMOptions = { maxTokens?: number; temperature?: number }
// Content multimodal (doar pentru transcriere): text + audio base64.
type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'input_audio'; input_audio: { data: string; format: string } }
type OpenRouterMessage = ChatMessage | { role: 'user'; content: ContentPart[] }

async function callOpenRouter(model: string, messages: OpenRouterMessage[], options?: LLMOptions): Promise<string> {
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
    // Corpul erorii NU intră în mesaj: unii provideri ecouează promptul (mesajele contactelor = PII),
    // iar eroarea ajunge în loguri. Păstrăm doar statusul și modelul.
    await res.body?.cancel().catch(() => {})
    throw new Error(`OpenRouter HTTP ${res.status} (${model})`)
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string | null } }>
    error?: { code?: number | string }
  }
  // Doar codul erorii (nu mesajul, care poate cita conținutul cererii).
  if (data.error) throw new Error(`OpenRouter error (${model}): code ${data.error.code ?? 'unknown'}`)
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

export const isTranscriptionEnabled = Boolean(env.LLM_AUDIO_MODEL)

// Transcriere vocală prin OpenRouter (model cu input audio, din LLM_AUDIO_MODEL).
// Apelată doar când LLM_AUDIO_MODEL e setat. Vocalele WhatsApp vin ca `audio/ogg; codecs=opus` → format `ogg`.
export async function transcribeAudio(buffer: Buffer, mimeType = 'audio/ogg'): Promise<string> {
  if (!env.LLM_AUDIO_MODEL) throw new Error('LLM_AUDIO_MODEL nesetat — transcrierea e dezactivată')
  const format = mimeType.split(';')[0].split('/')[1]?.trim() || 'ogg'
  return callOpenRouter(env.LLM_AUDIO_MODEL, [{
    role: 'user',
    content: [
      { type: 'text', text: 'Transcrie exact, cuvânt cu cuvânt, acest mesaj vocal. Returnează doar textul transcris.' },
      { type: 'input_audio', input_audio: { data: buffer.toString('base64'), format } },
    ],
  }], { maxTokens: 1000, temperature: 0 })
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
