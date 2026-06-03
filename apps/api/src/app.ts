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
import { AppError } from './utils/errors.js'
import { isEncryptionConfigured } from './utils/crypto.js'

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

  // H2: fără cheie de criptare, creds-urile WhatsApp se stochează necriptat. Semnalăm zgomotos
  // (error în prod) ca să nu treacă neobservat la deploy.
  if (!isEncryptionConfigured) {
    const msg = 'WHATSAPP_ENC_KEY nesetat — credențialele WhatsApp se stochează NECRIPTAT la rest (H2). Setează `openssl rand -hex 32` în env.'
    if (env.NODE_ENV === 'production') app.log.error(msg)
    else app.log.warn(msg)
  }

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
  // Rate limit GLOBAL cu fallback rezonabil (H1). Rutele cu `config.rateLimit` propriu îl
  // suprascriu; cele fără primesc acest default per-IP. Dezactivat în test/E2E ca să nu pice
  // suitele care fac multe cereri de la același IP (același pattern ca `rl()` din auth.routes).
  // NB: cheia e `req.ip`, spoofabilă sub `trustProxy: true` — vezi M1 (de strâns separat).
  const rateLimitDisabled = env.NODE_ENV === 'test' || env.E2E_MODE === 'true'
  await app.register(rateLimit, {
    global: !rateLimitDisabled,
    max: 300,
    timeWindow: '1 minute',
  })

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

  // Rutele de test (inclusiv /test/reset care șterge toată baza) sunt apărate pe MAI multe straturi:
  //  1. EXCLUSE FIZIC din build-ul de producție (vezi `exclude` în tsconfig.json) → nici nu există
  //     în `dist`, deci niciodată în artefactul deployat.
  //  2. Import DINAMIC cu cale ne-literală (tsc nu o urmărește, deci nu o readuce în build); în prod
  //     fișierul lipsește → importul ar eșua (prins mai jos), dar oricum nu ajungem aici.
  //  3. Montare doar dacă NODE_ENV ≠ production (default-ul e acum 'production' — fail-closed) ȘI
  //     E2E_MODE=true ȘI E2E_SECRET prezent.
  //  4. preHandler hard-guard în test.routes.ts care dă 404 dacă NODE_ENV === 'production'.
  if (env.NODE_ENV !== 'production' && env.E2E_MODE === 'true' && Boolean(env.E2E_SECRET)) {
    try {
      const testModulePath = `./modules/test/test.routes.${'js'}` // template ⇒ tsc nu rezolvă static
      const { testRoutes } = await import(testModulePath)
      await app.register(testRoutes, { prefix: '/api/v1/test' })
      app.log.warn('⚠️  Rute de test E2E montate — NU trebuie să apară în producție.')
    } catch (err) {
      app.log.error({ err: String(err) }, 'Rutele de test nu au putut fi încărcate (normal în prod, unde sunt excluse din build).')
    }
  }

  // Health check exceptat de la rate limit (monitorizare/uptime probes).
  app.get('/health', { config: { rateLimit: false } }, async () => ({ status: 'ok' }))

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
