import { z } from 'zod'

// docker compose / .env trimit `VAR=` ca string gol, nu ca lipsă. Tratăm gol = nesetat, ca
// `.optional()` / `.default()` să se aplice (altfel `.min(n)` respinge '' și boot-ul se oprește).
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const optionalStr = (min = 1) => z.preprocess(blankToUndefined, z.string().min(min).optional())

const envSchema = z.object({
  NODE_ENV: z.preprocess(blankToUndefined, z.enum(['development', 'production', 'test']).default('production')),
  PORT: z.preprocess(blankToUndefined, z.coerce.number().default(3001)),

  DATABASE_URL: z.string().min(1),

  // LLM prin OpenRouter (API OpenAI-compatible). Modelul se schimbă din env, fără redeploy de cod.
  OPENROUTER_API_KEY: z.string().min(1),
  LLM_MODEL: z.preprocess(blankToUndefined, z.string().min(1).default('google/gemini-2.5-flash')),
  // Opțional: model de rezervă încercat dacă primul pică (429/5xx/timeout).
  LLM_FALLBACK_MODEL: optionalStr(),

  // Opțional: transcriere mesaje vocale cu Groq Whisper. Lipsă → vocalele sunt ignorate.
  GROQ_API_KEY: optionalStr(),

  // Criptare AES-256-GCM a credențialelor WhatsApp în Postgres. Generează: openssl rand -hex 32.
  WHATSAPP_ENC_KEY: optionalStr(32),

  // Parola dashboard-ului minimal (HTTP Basic, user oricare). Lipsă → dashboard dezactivat
  // (QR-ul apare oricum în loguri).
  DASHBOARD_PASSWORD: optionalStr(12),

  // Override pentru userId-ul unic (doar la migrarea datelor dintr-o instalare SaaS existentă).
  // Folosit în config/owner.ts; validat aici doar ca documentare.
  OWNER_USER_ID: optionalStr(),

  // Nr. de proxy-uri de încredere în fața API-ului (Caddy / cloudflared = 1). NU folosi `true`.
  TRUST_PROXY_HOPS: z.preprocess(blankToUndefined, z.coerce.number().int().min(0).max(10).default(1)),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
