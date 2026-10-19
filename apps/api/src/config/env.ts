import { z } from 'zod'

// .env trimite `VAR=` ca string gol, nu ca lipsă. Tratăm gol = nesetat, ca
// `.optional()` / `.default()` să se aplice (altfel `.min(n)` respinge '' și boot-ul se oprește).
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const optionalStr = (min = 1) => z.preprocess(blankToUndefined, z.string().min(min).optional())

const envSchema = z.object({
  NODE_ENV: z.preprocess(blankToUndefined, z.enum(['development', 'production', 'test']).default('production')),

  DATABASE_URL: z.string().min(1),

  // LLM prin OpenRouter (API OpenAI-compatible). Modelul se schimbă din env, fără redeploy de cod.
  OPENROUTER_API_KEY: z.string().min(1),
  LLM_MODEL: z.preprocess(blankToUndefined, z.string().min(1).default('google/gemini-2.5-flash')),
  // Opțional: model de rezervă încercat dacă primul pică (429/5xx/timeout).
  LLM_FALLBACK_MODEL: optionalStr(),

  // Opțional: model OpenRouter cu input audio pentru transcrierea vocalelor (ex. `google/gemini-2.5-flash-lite`).
  // Lipsă → vocalele sunt ignorate.
  LLM_AUDIO_MODEL: optionalStr(),

  // Criptare AES-256-GCM a credențialelor WhatsApp în Postgres. Generează: openssl rand -hex 32.
  WHATSAPP_ENC_KEY: optionalStr(32),

  // Override pentru userId-ul unic (doar la migrarea datelor dintr-o instalare SaaS existentă).
  // Folosit în config/owner.ts; validat aici doar ca documentare.
  OWNER_USER_ID: optionalStr(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
