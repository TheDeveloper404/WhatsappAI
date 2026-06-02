import { randomUUID, createHmac, randomBytes } from 'crypto'
import type { FastifyInstance } from 'fastify'
import { db, pool } from '../../config/database.js'
import {
  users, refreshTokens, loginAttempts, subscriptions,
  whatsappSessions, aiSettings, contactsBlacklist,
  conversationMessages, platformConfig, notifications,
} from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../../utils/password.js'
import { createAccessToken } from '../../utils/tokens.js'
import { env } from '../../config/env.js'

// Rute disponibile NUMAI când E2E_MODE=true
// NU monta în producție

export async function testRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req, reply) => {
    // Defense-in-depth: chiar dacă ruta ar fi montată greșit (ex. NODE_ENV nesetat pe prod),
    // refuză categoric în producție. /test/reset șterge toată baza — nu trebuie să existe pe prod.
    if (env.NODE_ENV === 'production') {
      return reply.status(404).send({ error: 'Not found' })
    }
    const secret = req.headers['x-e2e-secret']
    if (!env.E2E_SECRET || secret !== env.E2E_SECRET) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // Resetează toată baza de date (apelat în beforeEach din Playwright)
  // Șterge tabelele în ordinea corectă (fk constraints), ignoring missing tables
  app.post('/reset', async (_req, reply) => {
    const tables = [
      'lead_insights', 'order_items', 'orders', 'products',
      'notifications', 'conversation_messages', 'contacts_blacklist',
      'contact_memory', 'ai_settings', 'platform_config', 'whatsapp_sessions',
      'subscriptions', 'login_attempts', 'refresh_tokens', 'users',
    ]
    for (const table of tables) {
      try { await pool.query(`DELETE FROM ${table}`) } catch { /* skip if table missing */ }
    }
    return reply.send({ ok: true })
  })

  // Creează un user pre-verificat cu subscripție mock, returnează accessToken direct
  app.post('/create-user', async (req, reply) => {
    const { name = 'Test User', email, password = 'Password123!', withSubscription = false } = req.body as {
      name?: string; email: string; password?: string; withSubscription?: boolean
    }

    const now = Date.now()
    const userId = randomUUID()
    const passwordHash = await hashPassword(password)

    await db.insert(users).values({
      id: userId, name, email,
      passwordHash,
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyTokenExpiry: null,
      resetPasswordToken: null,
      resetPasswordTokenExpiry: null,
      role: 'user',
      createdAt: now,
      updatedAt: now,
    })

    if (withSubscription) {
      await db.insert(subscriptions).values({
        id: randomUUID(),
        userId,
        stripeCustomerId: `cus_e2e_${userId.slice(0, 8)}`,
        stripeSubscriptionId: `sub_e2e_${userId.slice(0, 8)}`,
        plan: 'monthly',
        status: 'trialing',
        trialEndsAt: now + 7 * 86_400_000,
        currentPeriodEndsAt: now + 30 * 86_400_000,
        createdAt: now,
        updatedAt: now,
      })
    }

    // Pre-creează ai_settings cu prompt ASCII-safe pentru a evita erori de encoding la INSERT
    await db.insert(aiSettings).values({
      id: randomUUID(),
      userId,
      isActive: false,
      adminDisabled: false,
      timerMinutes: 5,
      systemPrompt: 'Tu esti un asistent AI care raspunde la WhatsApp in locul tau.',
      knowledgeBase: '',
      writingStyle: '',
      pauseUntil: null,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing()

    const accessToken = createAccessToken(userId, 'user')
    return reply.send({ userId, email, accessToken })
  })

  // Generează un token de verificare email fresh pentru un user (ca să testăm fluxul complet de register)
  // Stochează hash-ul în DB, returnează token-ul raw — consistent cu logica din producție
  app.get('/email-token', async (req, reply) => {
    const { email } = req.query as { email: string }
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = createHmac('sha256', env.JWT_ACCESS_SECRET).update(rawToken).digest('hex')
    const now = Date.now()
    await db.update(users).set({
      emailVerifyToken: tokenHash,
      emailVerifyTokenExpiry: now + 24 * 60 * 60 * 1000,
      updatedAt: now,
    }).where(eq(users.email, email))
    return reply.send({ token: rawToken })
  })

  // Returnează tokenul de resetare parolă pentru un user
  app.get('/reset-token', async (req, reply) => {
    const { email } = req.query as { email: string }
    const rows = await db.select({
      token: users.resetPasswordToken,
    }).from(users).where(eq(users.email, email))
    return reply.send({ token: rows[0]?.token ?? null })
  })

  // Creează un token de resetare parolă valid și returnează tokenul RAW (pentru testare E2E)
  app.post('/create-reset-token', async (req, reply) => {
    const { email } = req.body as { email: string }
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = createHmac('sha256', env.JWT_ACCESS_SECRET).update(rawToken).digest('hex')
    const now = Date.now()
    await db.update(users).set({
      resetPasswordToken: tokenHash,
      resetPasswordTokenExpiry: now + 60 * 60 * 1000,
      updatedAt: now,
    }).where(eq(users.email, email))
    return reply.send({ token: rawToken })
  })

  // Setează agentul AI ca activ pentru un user (shortcut pentru setup teste)
  app.post('/activate-agent', async (req, reply) => {
    const { userId } = req.body as { userId: string }
    const now = Date.now()
    await db.insert(aiSettings).values({
      id: randomUUID(), userId,
      isActive: true, adminDisabled: false,
      timerMinutes: 5, systemPrompt: 'Test prompt pentru E2E',
      pauseUntil: null, createdAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: aiSettings.userId,
      set: { isActive: true, adminDisabled: false, updatedAt: now },
    })
    return reply.send({ ok: true })
  })
}
