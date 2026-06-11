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
import type { Subscription } from '../../db/schema.js'
import { subscriptions } from '../../db/schema.js'
import {
  subTier, userTier, monthlyAiLimit, PRO_MONTHLY_AI_LIMIT,
  productLimit, ragChunkLimit, minTimerMinutes,
  PRODUCT_LIMIT, RAG_CHUNK_LIMIT, MIN_TIMER_MINUTES,
  visionAllowed, multiServiceAllowed,
} from './entitlement.js'
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
// subTier — funcție PURĂ. Tier-ul de valoare al unui abonament, separat de drept.
// ---------------------------------------------------------------------------

function makeSub(tier: string | null): Subscription {
  // Doar câmpurile relevante pentru subTier; restul nu contează pentru tier.
  return { tier } as unknown as Subscription
}

describe('subTier (pur) — nivelul de valoare al abonamentului', () => {
  it('fără abonament → null (undefined)', () => {
    expect(subTier(undefined)).toBeNull()
  })

  it('fără abonament → null (null)', () => {
    expect(subTier(null)).toBeNull()
  })

  it("tier='max' → 'max'", () => {
    expect(subTier(makeSub('max'))).toBe('max')
  })

  it("tier='pro' → 'pro'", () => {
    expect(subTier(makeSub('pro'))).toBe('pro')
  })

  it("tier=NULL (legacy 49/399) → 'pro' (grandfathering)", () => {
    expect(subTier(makeSub(null))).toBe('pro')
  })

  it("valoare neașteptată → 'pro' (fail-closed: nu acordă Max)", () => {
    expect(subTier(makeSub('enterprise'))).toBe('pro')
  })
})

// ---------------------------------------------------------------------------
// monthlyAiLimit — funcție PURĂ. Plafonul lunar de răspunsuri AI derivat din tier.
// ---------------------------------------------------------------------------

describe('monthlyAiLimit (pur) — plafon AI lunar pe tier', () => {
  it("'max' → null (nelimitat)", () => {
    expect(monthlyAiLimit('max')).toBeNull()
  })

  it("'pro' → PRO_MONTHLY_AI_LIMIT", () => {
    expect(monthlyAiLimit('pro')).toBe(PRO_MONTHLY_AI_LIMIT)
  })

  it('null (fără tier / legacy) → plafonul Pro (fail-closed pe cost)', () => {
    expect(monthlyAiLimit(null)).toBe(PRO_MONTHLY_AI_LIMIT)
  })
})

// ---------------------------------------------------------------------------
// Pârghii de tier (pas 3) — funcții PURE. Toate fail-closed: ≠'max' → limita Pro.
// ---------------------------------------------------------------------------

describe('pârghii de tier (pure) — plafoane pe tier', () => {
  it('productLimit: max > pro, fail-closed pe pro', () => {
    expect(productLimit('max')).toBe(PRODUCT_LIMIT.max)
    expect(productLimit('pro')).toBe(PRODUCT_LIMIT.pro)
    expect(productLimit(null)).toBe(PRODUCT_LIMIT.pro)
  })

  it('ragChunkLimit: max > pro, fail-closed pe pro', () => {
    expect(ragChunkLimit('max')).toBe(RAG_CHUNK_LIMIT.max)
    expect(ragChunkLimit('pro')).toBe(RAG_CHUNK_LIMIT.pro)
    expect(ragChunkLimit(null)).toBe(RAG_CHUNK_LIMIT.pro)
  })

  it('minTimerMinutes: max coboară mai jos decât pro, fail-closed pe pro', () => {
    expect(minTimerMinutes('max')).toBe(MIN_TIMER_MINUTES.max)
    expect(minTimerMinutes('pro')).toBe(MIN_TIMER_MINUTES.pro)
    expect(minTimerMinutes(null)).toBe(MIN_TIMER_MINUTES.pro)
    expect(MIN_TIMER_MINUTES.max).toBeLessThan(MIN_TIMER_MINUTES.pro)
  })

  it('visionAllowed: doar Max (fail-closed)', () => {
    expect(visionAllowed('max')).toBe(true)
    expect(visionAllowed('pro')).toBe(false)
    expect(visionAllowed(null)).toBe(false)
  })

  it('multiServiceAllowed: doar Max (fail-closed)', () => {
    expect(multiServiceAllowed('max')).toBe(true)
    expect(multiServiceAllowed('pro')).toBe(false)
    expect(multiServiceAllowed(null)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// userTier — varianta async, scoped pe user (citește abonamentul din DB).
// ---------------------------------------------------------------------------

async function registerUser(email: string): Promise<string> {
  vi.mocked(sendVerificationEmail).mockClear()
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { name: 'Tier User', email, password: 'Password123!' },
  })
  const [, , token] = vi.mocked(sendVerificationEmail).mock.calls[0] as [string, string, string]
  await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token } })
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'Password123!' },
  })
  return res.json().user.id as string
}

async function seedSubWithTier(userId: string, tier: 'pro' | 'max' | null) {
  const now = Date.now()
  await db.insert(subscriptions).values({
    id: randomUUID(),
    userId,
    stripeCustomerId: `cus_${userId}`,
    stripeSubscriptionId: `sub_${userId}`,
    plan: 'monthly',
    status: 'active',
    tier,
    trialEndsAt: now + 7 * 86_400_000,
    currentPeriodEndsAt: now + 30 * 86_400_000,
    cancelAtPeriodEnd: false,
    createdAt: now,
    updatedAt: now,
  })
}

describe('userTier (DB) — nivelul abonamentului unui user', () => {
  it('user fără abonament → null', async () => {
    const userId = await registerUser('tier-none@test.com')
    expect(await userTier(userId)).toBeNull()
  })

  it("user cu tier=NULL (legacy) → 'pro' (grandfathering)", async () => {
    const userId = await registerUser('tier-legacy@test.com')
    await seedSubWithTier(userId, null)
    expect(await userTier(userId)).toBe('pro')
  })

  it("user cu tier='pro' → 'pro'", async () => {
    const userId = await registerUser('tier-pro@test.com')
    await seedSubWithTier(userId, 'pro')
    expect(await userTier(userId)).toBe('pro')
  })

  it("user cu tier='max' → 'max'", async () => {
    const userId = await registerUser('tier-max@test.com')
    await seedSubWithTier(userId, 'max')
    expect(await userTier(userId)).toBe('max')
  })
})
