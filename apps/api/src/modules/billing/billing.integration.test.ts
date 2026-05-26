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

let app: FastifyInstance

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

// ---------------------------------------------------------------------------
// GET /billing/subscription
// ---------------------------------------------------------------------------

describe('GET /billing/subscription', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/billing/subscription' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — returnează null când nu există subscripție', async () => {
    const accessToken = await registerAndLogin()
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/subscription',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().subscription).toBeNull()
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
