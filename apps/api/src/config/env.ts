import { z } from 'zod'

process.stdout.write('[ENV] env.ts loaded\n')

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

  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_SECRET: z.string().min(32).optional(),
  E2E_MODE: z.enum(['true', 'false']).optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
process.stdout.write('[ENV] env.ts OK - PORT=' + parsed.data.PORT + ' NODE_ENV=' + parsed.data.NODE_ENV + '\n')
