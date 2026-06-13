import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'

vi.mock('../../utils/email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendAdminNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendCustomEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../config/stripe.js', () => ({
  stripe: {
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_test123' }),
    },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/test' }),
      },
    },
  },
}))

import { sendVerificationEmail } from '../../utils/email.js'
import { stripe } from '../../config/stripe.js'
import { db } from '../../config/database.js'
import { subscriptions } from '../../db/schema.js'
import { randomUUID } from 'crypto'

let app: FastifyInstance

// Seed direct un abonament activ pentru un user (ca să verificăm flag-ul `entitled` din rută).
async function seedActiveSubscription(userId: string) {
  const now = Date.now()
  await db.insert(subscriptions).values({
    id: randomUUID(),
    userId,
    stripeCustomerId: `cus_${userId}`,
    stripeSubscriptionId: `sub_${userId}`,
    plan: 'monthly',
    status: 'active',
    trialEndsAt: now + 7 * 86_400_000,
    currentPeriodEndsAt: now + 30 * 86_400_000,
    cancelAtPeriodEnd: false,
    createdAt: now,
    updatedAt: now,
  })
}

// Ultimul price ID + metadata cu care a fost chemat Stripe checkout (mock) — ca să verificăm maparea (tier × plan).
function lastCheckoutArgs() {
  const calls = vi.mocked(stripe.checkout.sessions.create).mock.calls
  const arg = calls.at(-1)?.[0] as { line_items: { price: string }[]; metadata: Record<string, string> }
  return { price: arg.line_items[0].price, metadata: arg.metadata }
}

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

async function registerAndLogin(email = 'billing@example.com') {
  vi.mocked(sendVerificationEmail).mockClear()
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { name: 'Billing User', email, password: 'Password123!' },
  })
  const [, , token] = vi.mocked(sendVerificationEmail).mock.calls[0] as [string, string, string]
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/verify-email',
    payload: { token },
  })
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'Password123!' },
  })
  return res.json().accessToken as string
}

// Variantă care întoarce și userId-ul (pentru seed de abonament).
async function registerLoginId(email: string): Promise<{ accessToken: string; userId: string }> {
  const accessToken = await registerAndLogin(email)
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'Password123!' },
  })
  return { accessToken, userId: res.json().user.id as string }
}

// ---------------------------------------------------------------------------
// GET /billing/subscription
// ---------------------------------------------------------------------------

describe('GET /billing/subscription', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/billing/subscription' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — returnează null + entitled:false când nu există subscripție', async () => {
    const accessToken = await registerAndLogin()
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/subscription',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().subscription).toBeNull()
    expect(res.json().entitled).toBe(false)
  })

  it('200 — entitled:true când există abonament activ (gate-ul de UI nu mai trimite pe /subscribe)', async () => {
    const { accessToken, userId } = await registerLoginId('billing-entitled@example.com')
    await seedActiveSubscription(userId)
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/subscription',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().subscription.status).toBe('active')
    expect(res.json().entitled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// POST /billing/checkout
// ---------------------------------------------------------------------------

describe('POST /billing/checkout', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      payload: { plan: 'monthly' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('400 — plan invalid', async () => {
    const accessToken = await registerAndLogin('checkout-invalid@example.com')
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      payload: { plan: 'weekly' },
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('200 — returnează URL Stripe Checkout', async () => {
    const accessToken = await registerAndLogin('checkout-valid@example.com')
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      payload: { plan: 'monthly' },
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().url).toBe('https://checkout.stripe.com/test')
  })

  it('200 — plan annual funcționează', async () => {
    const accessToken = await registerAndLogin('checkout-annual@example.com')
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      payload: { plan: 'annual' },
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().url).toBeDefined()
  })

  // --- Etapa 2.2a: tier (Pro/Max) ---

  it("tier='pro' default când e omis → price Pro + metadata.tier='pro' + sub persistă tier", async () => {
    const accessToken = await registerAndLogin('checkout-default-pro@example.com')
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      payload: { plan: 'monthly' }, // fără tier
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const { price, metadata } = lastCheckoutArgs()
    expect(price).toBe('price_test_pro_monthly')
    expect(metadata.tier).toBe('pro')

    // Rândul 'incomplete' creat la checkout reține tier-ul.
    const sub = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/subscription',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(sub.json().subscription.tier).toBe('pro')
  })

  it("tier='max' + monthly → price Max monthly + metadata.tier='max'", async () => {
    const accessToken = await registerAndLogin('checkout-max-monthly@example.com')
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      payload: { plan: 'monthly', tier: 'max' },
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const { price, metadata } = lastCheckoutArgs()
    expect(price).toBe('price_test_max_monthly')
    expect(metadata.tier).toBe('max')
  })

  it("tier='max' + annual → price Max annual", async () => {
    const accessToken = await registerAndLogin('checkout-max-annual@example.com')
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      payload: { plan: 'annual', tier: 'max' },
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(lastCheckoutArgs().price).toBe('price_test_max_annual')
  })

  it('400 — tier invalid', async () => {
    const accessToken = await registerAndLogin('checkout-bad-tier@example.com')
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      payload: { plan: 'monthly', tier: 'enterprise' },
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// POST /billing/portal
// ---------------------------------------------------------------------------

describe('POST /billing/portal', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/billing/portal' })
    expect(res.statusCode).toBe(401)
  })

  it('404 — fără subscripție existentă', async () => {
    const accessToken = await registerAndLogin('portal-no-sub@example.com')
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/portal',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(404)
  })
})
