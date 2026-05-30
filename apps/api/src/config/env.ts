import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  DATABASE_URL: z.string().default('./data/app.db'),

  RESEND_API_KEY: z.string(),
  EMAIL_FROM: z.string().email(),

  APP_URL: z.string().url(),
  API_URL: z.string().url(),

  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_PRICE_MONTHLY_ID: z.string().min(1),
  STRIPE_PRICE_ANNUAL_ID: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),

  GROQ_API_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().optional(),
  // Furnizor pentru generarea de text. Transcrierea vocală rămâne mereu pe Groq (Whisper).
  LLM_PROVIDER: z.enum(['groq', 'gemini']).default('groq'),

  CORS_ORIGINS: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_SECRET: z.string().min(4).optional(),
  E2E_MODE: z.enum(['true', 'false']).optional(),
  E2E_SECRET: z.string().min(16).optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
