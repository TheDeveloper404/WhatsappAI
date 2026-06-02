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
import { productsRoutes } from './modules/orders/products.routes.js'
import { ordersRoutes } from './modules/orders/orders.routes.js'
import { appointmentsRoutes } from './modules/orders/appointments.routes.js'
import { knowledgeRoutes } from './modules/knowledge/knowledge.routes.js'
import { testRoutes } from './modules/test/test.routes.js'
import { AppError } from './utils/errors.js'

// Adaugă coloane/tabele noi fără a rupe schema existentă (idempotent)
async function runStartupMigrations() {
  const stmts = [
    `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS knowledge_base TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS writing_style TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS notify_on_ai_takeover BOOLEAN NOT NULL DEFAULT TRUE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_scheduled_at BIGINT`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at BIGINT`,
    `ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS is_ai BOOLEAN NOT NULL DEFAULT FALSE`,
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
    `CREATE TABLE IF NOT EXISTS stripe_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_bani INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')),
      total_bani INTEGER NOT NULL DEFAULT 0,
      customer_note TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT,
      product_name TEXT NOT NULL,
      unit_price_bani INTEGER NOT NULL,
      quantity INTEGER NOT NULL
    )`,
    `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS lead_criteria TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'RON'`,
    `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS order_intake_prompt TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS details TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_estimate BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bookable BOOLEAN NOT NULL DEFAULT FALSE`,
    `CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      public_ref TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')),
      service_name TEXT NOT NULL,
      requested_slot TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments(user_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS lead_insights (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'cold' CHECK(status IN ('hot','warm','cold')),
      score INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      UNIQUE(user_id, contact_phone)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_lead_insights_user ON lead_insights(user_id, score)`,
  ]
  for (const stmt of stmts) {
    try { await pool.query(stmt) } catch { /* tabela poate lipsi la prima rulare */ }
  }
}

export async function buildApp() {
  await runStartupMigrations()

  const app = Fastify({ logger: env.NODE_ENV !== 'test', trustProxy: true })

  await app.register(cookie)
  const allowedOrigins = new Set([
    env.APP_URL.replace(/\/$/, ''),
    ...(env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, '')) : []),
  ])
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) {
        cb(null, true)
      } else {
        cb(new Error('Not allowed by CORS'), false)
      }
    },
    credentials: true,
  })
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
  await app.register(rateLimit, { global: false })

  await app.register(authRoutes, { prefix: '/api/v1/auth' })
  await app.register(userRoutes, { prefix: '/api/v1/users' })
  await app.register(billingRoutes, { prefix: '/api/v1/billing' })
  await app.register(stripeWebhookRoutes, { prefix: '/webhooks' })
  await app.register(whatsappRoutes, { prefix: '/api/v1/whatsapp' })
  await app.register(aiRoutes, { prefix: '/api/v1/ai' })
  await app.register(adminRoutes, { prefix: '/api/v1/admin' })
  await app.register(productsRoutes, { prefix: '/api/v1/products' })
  await app.register(ordersRoutes, { prefix: '/api/v1/orders' })
  await app.register(appointmentsRoutes, { prefix: '/api/v1/appointments' })
  await app.register(knowledgeRoutes, { prefix: '/api/v1/knowledge' })

  // Rutele de test (inclusiv /test/reset care șterge toată baza) se montează DOAR în afara
  // producției și doar dacă există un E2E_SECRET. Handler-ele au în plus un guard hard pe prod.
  if (env.E2E_MODE === 'true' && env.NODE_ENV !== 'production' && Boolean(env.E2E_SECRET)) {
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
