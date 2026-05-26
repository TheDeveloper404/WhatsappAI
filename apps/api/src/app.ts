import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { env } from './config/env.js'
import { pool } from './config/database.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { userRoutes } from './modules/users/user.routes.js'
import { billingRoutes } from './modules/billing/billing.routes.js'
import { stripeWebhookRoutes } from './modules/webhooks/stripe.webhook.js'
import { whatsappRoutes } from './modules/whatsapp/whatsapp.routes.js'
import { aiRoutes } from './modules/ai/ai.routes.js'
import { adminRoutes } from './modules/admin/admin.routes.js'
import { testRoutes } from './modules/test/test.routes.js'
import { AppError } from './utils/errors.js'

// Adaugă coloane/tabele noi fără a rupe schema existentă (idempotent)
async function runStartupMigrations() {
  const stmts = [
    `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS knowledge_base TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS writing_style TEXT NOT NULL DEFAULT ''`,
    `CREATE TABLE IF NOT EXISTS contact_memory (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_phone TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      UNIQUE(user_id, contact_phone)
    )`,
    `CREATE TABLE IF NOT EXISTS whatsapp_auth_state (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key_type TEXT NOT NULL,
      key_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (user_id, key_type, key_id)
    )`,
  ]
  for (const stmt of stmts) {
    try { await pool.query(stmt) } catch { /* tabela poate lipsi la prima rulare */ }
  }
}

export async function buildApp() {
  await runStartupMigrations()

  const app = Fastify({ logger: env.NODE_ENV !== 'test', trustProxy: true })

  await app.register(cookie)
  const allowedOrigin = env.APP_URL.replace(/\/$/, '')
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || origin.replace(/\/$/, '') === allowedOrigin) {
        cb(null, true)
      } else {
        cb(new Error('Not allowed by CORS'), false)
      }
    },
    credentials: true,
  })
  await app.register(helmet, { contentSecurityPolicy: false, crossOriginEmbedderPolicy: false })
  await app.register(rateLimit, { global: false })

  await app.register(authRoutes, { prefix: '/api/v1/auth' })
  await app.register(userRoutes, { prefix: '/api/v1/users' })
  await app.register(billingRoutes, { prefix: '/api/v1/billing' })
  await app.register(stripeWebhookRoutes, { prefix: '/api/v1/webhooks' })
  await app.register(whatsappRoutes, { prefix: '/api/v1/whatsapp' })
  await app.register(aiRoutes, { prefix: '/api/v1/ai' })
  await app.register(adminRoutes, { prefix: '/api/v1/admin' })

  if (env.E2E_MODE === 'true') {
    await app.register(testRoutes, { prefix: '/api/v1/test' })
  }

  app.get('/health', async () => ({ status: 'ok' }))

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      const body: Record<string, unknown> = {
        error: { code: error.code, message: error.message },
      }
      if (error.details) (body.error as Record<string, unknown>).details = error.details
      return reply.status(error.statusCode).send(body)
    }
    if (error.statusCode === 429) {
      return reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests.' } })
    }
    app.log.error(error)
    return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } })
  })

  return app
}
