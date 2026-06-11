import Fastify, { type FastifyError } from 'fastify'
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
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_token TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_token_expiry BIGINT`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at BIGINT`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_event_at BIGINT`,
    // Etapa 2.2a — tier (Pro/Max); NULL = legacy → tratat ca Pro în cod. CHECK trece pe NULL.
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tier TEXT CHECK(tier IN ('pro','max'))`,
    `ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS is_ai BOOLEAN NOT NULL DEFAULT FALSE`,
    // Refresh token reuse detection / family revocation (L10).
    `ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS family_id TEXT`,
    `ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS rotated_at BIGINT`,
    `UPDATE refresh_tokens SET family_id = id WHERE family_id IS NULL`,
    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id)`,
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
    `CREATE TABLE IF NOT EXISTS admin_audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      target_user_id TEXT,
      metadata TEXT,
      ip TEXT,
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
    // Etapa 2.2a — contor consum AI lunar pentru plafonul de tier (Pro cap, Max nelimitat).
    `CREATE TABLE IF NOT EXISTS ai_usage (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      period_month TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (user_id, period_month)
    )`,
  ]
  for (const stmt of stmts) {
    try { await pool.query(stmt) } catch { /* tabela poate lipsi la prima rulare */ }
  }
}

export async function buildApp() {
  await runStartupMigrations()

  // trustProxy = nr. EXACT de proxy-uri de încredere (M1), nu `true`. Cu `true`, `req.ip` devine
  // valoarea cea mai din stânga din X-Forwarded-For, controlabilă de client → bypass de rate-limit.
  // Cu un număr, `req.ip` se ia la offset fix din dreapta (hop-urile reale de infra), nespoofabil.
  // bodyLimit explicit (1 MB): respinge payload-urile JSON abuzive cu 413 curat în loc să le lase
  // să consume resurse. Acoperă cu marjă cea mai mare cerere legitimă (import 1000 produse ≈ 770KB).
  // Upload-ul de documente folosește multipart, care are limita lui separată (vezi knowledge.routes).
  const app = Fastify({ logger: env.NODE_ENV !== 'test', trustProxy: env.TRUST_PROXY_HOPS, bodyLimit: 1_048_576 })

  // H2: fără cheie de criptare, creds-urile WhatsApp se stochează necriptat. Semnalăm zgomotos
  // (error în prod) ca să nu treacă neobservat la deploy.
  if (!isEncryptionConfigured) {
    const msg = 'WHATSAPP_ENC_KEY nesetat — credențialele WhatsApp se stochează NECRIPTAT la rest (H2). Setează `openssl rand -hex 32` în env.'
    if (env.NODE_ENV === 'production') app.log.error(msg)
    else app.log.warn(msg)
  }

  // M5: dacă admin-ul e activat dar nu are secret de sesiune dedicat, sesiunea admin se derivă din
  // JWT_ACCESS_SECRET (un compromis al acestuia ar permite și forjarea sesiunilor admin).
  if (env.ADMIN_SECRET && !env.ADMIN_SESSION_SECRET) {
    app.log.warn('ADMIN_SESSION_SECRET nesetat — sesiunea admin se derivă din JWT_ACCESS_SECRET (M5). Setează un secret dedicat în prod.')
  }

  // Error handler-ul TREBUIE setat ÎNAINTE de a înregistra rutele. Cu `await app.register(...)`,
  // fiecare plugin de rută se boot-ează pe loc și moștenește error handler-ul EXISTENT atunci; dacă
  // îl setam după rute, plugin-urile prindeau handler-ul DEFAULT al lui Fastify (forma plată
  // `{statusCode, code, error, message}`) → envelope-ul nostru `{error:{code}}` era ignorat.
  app.setErrorHandler((error: FastifyError, _req, reply) => {
    if (error instanceof AppError) {
      const body: Record<string, unknown> = {
        error: { code: error.code, message: error.message },
      }
      if (error.details) (body.error as Record<string, unknown>).details = error.details
      return reply.status(error.statusCode).send(body)
    }
    // Erorile Fastify-interne cu status de CLIENT (4xx) — JSON malformat (400), bodyLimit (413),
    // media-type nesuportat (415), rate-limit (429) — sunt „vina clientului": păstrăm statusul lor
    // nativ (NU le forțăm 500), doar le normalizăm în envelope-ul nostru. Mesajul lor e generic
    // (despre cererea clientului), nu logică internă → safe de expus.
    const sc = error.statusCode
    if (typeof sc === 'number' && sc >= 400 && sc < 500) {
      return reply.status(sc).send({ error: { code: error.code ?? 'BAD_REQUEST', message: error.message } })
    }
    // 5xx și restul: mascat — NU scurgem mesajul/stack-ul real al erorii (logat doar server-side).
    app.log.error(error)
    return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } })
  })

  // 404-urile NU trec prin setErrorHandler → handler dedicat ca să răspundă în ACELAȘI envelope
  // `{error:{code}}` ca restul API-ului (înainte ieșeau pe forma plată default Fastify). Setat tot
  // înainte de rute, din același motiv de moștenire la boot ca error handler-ul de mai sus.
  app.setNotFoundHandler((_req, reply) => {
    return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Resursa cerută nu există.' } })
  })

  // Fastify 5 respinge cu 400 (FST_ERR_CTP_EMPTY_JSON_BODY) orice cerere cu `content-type:
  // application/json` și body gol — inclusiv DELETE-urile fără body trimise de client (ștergere
  // user/produs/blacklist, disconnect-wa etc.), care în Fastify 4 treceau. Restaurăm comportamentul
  // de dinainte: body gol → undefined; restul merge prin parser-ul JSON securizat default (păstrăm
  // protecția anti proto/constructor-poisoning, deci fără regresie de securitate).
  // Fastify are deja un parser înregistrat pentru `application/json`; trebuie eliminat înainte de
  // a-l înlocui, altfel `addContentTypeParser` aruncă FST_ERR_CTP_ALREADY_PRESENT la boot.
  const defaultJsonParser = app.getDefaultJsonParser('error', 'error')
  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (body === '') return done(null, undefined)
    defaultJsonParser(req, body as string, done)
  })

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
        // F5: respingem cu 403 (nu 500). Un Error simplu ar cădea pe ramura generică din
        // setErrorHandler → 500 zgomotos. AppError(403) e tratat ca refuz curat de acces.
        cb(new AppError(403, 'CORS_REJECTED', 'Not allowed by CORS'), false)
      }
    },
    // @fastify/cors v11 a strâns default-ul `methods` la CORS-safelisted (`GET,HEAD,POST`),
    // ceea ce blochează preflight-ul pentru DELETE/PUT/PATCH (ștergere produs/user, editări).
    // Le declarăm explicit ca să nu depindem de default-ul plugin-ului la upgrade-uri viitoare.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
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
  const rateLimitDisabled = env.NODE_ENV === 'test' || env.E2E_MODE === 'true'
  // F1: când API-ul e fronted de Cloudflare (și accesul direct la Railway e blocat), cheia de
  // rate-limit devine `CF-Connecting-IP` — setat de edge-ul Cloudflare, nu de client → nespoofabil.
  // Gated pe env (default off): fără Cloudflare în față, header-ul ar fi spoofabil pe ruta directă.
  // keyGenerator-ul global e moștenit și de limitele per-rută (auth/admin etc.).
  const trustCfIp = env.TRUST_CF_CONNECTING_IP === 'true'
  await app.register(rateLimit, {
    global: !rateLimitDisabled,
    max: 300,
    timeWindow: '1 minute',
    ...(trustCfIp && {
      keyGenerator: (req) => {
        const cf = req.headers['cf-connecting-ip']
        return (typeof cf === 'string' && cf.length > 0) ? cf : req.ip
      },
    }),
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

  return app
}
