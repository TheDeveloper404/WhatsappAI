import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'

vi.mock('../../utils/email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendAdminNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendCustomEmail: vi.fn().mockResolvedValue(undefined),
  sendAccountDeletionEmail: vi.fn().mockResolvedValue(undefined),
}))

import { sendVerificationEmail } from '../../utils/email.js'
import { db } from '../../config/database.js'
import { subscriptions } from '../../db/schema.js'
import { randomUUID } from 'crypto'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

// ---------------------------------------------------------------------------
// Helpers — deliberat FĂRĂ seed de abonament (spre deosebire de celelalte suite),
// fiindcă AICI testăm exact gate-ul de abonament (C1/C2), nu logica de după el.
// ---------------------------------------------------------------------------

async function registerAndLogin(email: string): Promise<{ accessToken: string; userId: string }> {
  vi.mocked(sendVerificationEmail).mockClear()
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { name: 'Gate User', email, password: 'Password123!' },
  })
  const [, , token] = vi.mocked(sendVerificationEmail).mock.calls[0] as [string, string, string]
  await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token } })
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'Password123!' },
  })
  const body = res.json()
  return { accessToken: body.accessToken as string, userId: body.user.id as string }
}

type SubStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'

async function seedSubscription(
  userId: string,
  status: SubStatus,
  overrides: Partial<{ trialEndsAt: number; currentPeriodEndsAt: number; cancelAtPeriodEnd: boolean }> = {},
) {
  const now = Date.now()
  await db.insert(subscriptions).values({
    id: randomUUID(),
    userId,
    stripeCustomerId: `cus_${userId}`,
    stripeSubscriptionId: `sub_${userId}`,
    plan: 'monthly',
    status,
    trialEndsAt: overrides.trialEndsAt ?? now + 7 * 86_400_000,
    currentPeriodEndsAt: overrides.currentPeriodEndsAt ?? now + 30 * 86_400_000,
    cancelAtPeriodEnd: overrides.cancelAtPeriodEnd ?? false,
    createdAt: now,
    updatedAt: now,
  })
}

// O rută premium reprezentativă, gated cu [authenticate, requireActiveSubscription].
const PREMIUM_URL = '/api/v1/ai/settings'

async function getPremium(accessToken: string) {
  return app.inject({
    method: 'GET',
    url: PREMIUM_URL,
    headers: { authorization: `Bearer ${accessToken}` },
  })
}

// ---------------------------------------------------------------------------
// C1/C2 — Gate de abonament server-side (Broken Access Control, OWASP #1)
// Exact vectorul pe care a intrat pentester-ul real: token valid ≠ drept de acces.
// ---------------------------------------------------------------------------

describe('Gate de abonament (C1/C2) — requireActiveSubscription', () => {
  it('402 SUBSCRIPTION_REQUIRED — user autentificat FĂRĂ abonament (gaura originală)', async () => {
    const { accessToken } = await registerAndLogin('gate-none@test.com')
    const res = await getPremium(accessToken)
    expect(res.statusCode).toBe(402)
    // Robust la structura corpului: clientul are nevoie de codul SUBSCRIPTION_REQUIRED ca să
    // distingă 402 (du-te la /subscribe) de 401 (sesiune expirată). Verificăm pe payload-ul brut.
    expect(res.body).toContain('SUBSCRIPTION_REQUIRED')
  })

  it('200 — user cu abonament ACTIVE trece de gate', async () => {
    const { accessToken, userId } = await registerAndLogin('gate-active@test.com')
    await seedSubscription(userId, 'active')
    const res = await getPremium(accessToken)
    expect(res.statusCode).toBe(200)
  })

  it('200 — trial nevalidat (trialing, neexpirat) trece de gate', async () => {
    const { accessToken, userId } = await registerAndLogin('gate-trial@test.com')
    await seedSubscription(userId, 'trialing', { trialEndsAt: Date.now() + 86_400_000 })
    const res = await getPremium(accessToken)
    expect(res.statusCode).toBe(200)
  })

  it('402 — trial EXPIRAT este refuzat (fail-closed contra webhook ratat)', async () => {
    const { accessToken, userId } = await registerAndLogin('gate-trial-expired@test.com')
    await seedSubscription(userId, 'trialing', { trialEndsAt: Date.now() - 1000 })
    const res = await getPremium(accessToken)
    expect(res.statusCode).toBe(402)
  })

  it('402 — past_due refuzat', async () => {
    const { accessToken, userId } = await registerAndLogin('gate-pastdue@test.com')
    await seedSubscription(userId, 'past_due')
    const res = await getPremium(accessToken)
    expect(res.statusCode).toBe(402)
  })

  it('402 — canceled refuzat', async () => {
    const { accessToken, userId } = await registerAndLogin('gate-canceled@test.com')
    await seedSubscription(userId, 'canceled')
    const res = await getPremium(accessToken)
    expect(res.statusCode).toBe(402)
  })

  it('402 — incomplete refuzat', async () => {
    const { accessToken, userId } = await registerAndLogin('gate-incomplete@test.com')
    await seedSubscription(userId, 'incomplete')
    const res = await getPremium(accessToken)
    expect(res.statusCode).toBe(402)
  })

  it('402 — active dar cancelAtPeriodEnd cu perioada EXPIRATĂ (backstop M7) refuzat', async () => {
    const { accessToken, userId } = await registerAndLogin('gate-active-lapsed@test.com')
    await seedSubscription(userId, 'active', {
      cancelAtPeriodEnd: true,
      currentPeriodEndsAt: Date.now() - 1000,
    })
    const res = await getPremium(accessToken)
    expect(res.statusCode).toBe(402)
  })

  it('401 — fără token (gate-ul nu maschează lipsa autentificării)', async () => {
    const res = await app.inject({ method: 'GET', url: PREMIUM_URL })
    expect(res.statusCode).toBe(401)
  })

  it('gate-ul e SCOPAT pe rute premium: /users/me merge FĂRĂ abonament', async () => {
    const { accessToken } = await registerAndLogin('gate-scope@test.com')
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
  })
})
