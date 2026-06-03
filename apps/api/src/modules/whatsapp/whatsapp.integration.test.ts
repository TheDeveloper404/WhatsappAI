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
    customers: { create: vi.fn().mockResolvedValue({ id: 'cus_test123' }) },
    checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }) } },
    billingPortal: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/test' }) } },
  },
}))

// Mock the session manager so tests don't open real WhatsApp connections
vi.mock('./whatsapp.session-manager.js', () => ({
  requestQrCode: vi.fn().mockResolvedValue('data:image/png;base64,MOCKQR=='),
  disconnectSession: vi.fn().mockResolvedValue(undefined),
  getActiveSocket: vi.fn().mockReturnValue(undefined),
  restoreSession: vi.fn().mockResolvedValue(undefined),
  restoreAllSessions: vi.fn().mockResolvedValue(undefined),
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

async function registerAndLogin(email = 'wa@example.com') {
  vi.mocked(sendVerificationEmail).mockClear()
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { name: 'WA User', email, password: 'Password123!' },
  })
  const [, , token] = vi.mocked(sendVerificationEmail).mock.calls[0] as [string, string, string]
  await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token } })
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'Password123!' },
  })
  const body = res.json()
  // Gate de abonament (C1): rutele premium cer abonament activ. Seedăm unul ca testul să ajungă
  // la logica testată, nu să fie oprit la 402.
  await seedActiveSubscription(body.user.id)
  return body.accessToken as string
}

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
    createdAt: now,
    updatedAt: now,
  })
}

// ---------------------------------------------------------------------------
// GET /whatsapp/session
// ---------------------------------------------------------------------------

describe('GET /whatsapp/session', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/whatsapp/session' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — returnează null când nu există sesiune', async () => {
    const token = await registerAndLogin('wa-session-null@example.com')
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/whatsapp/session',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().session).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// POST /whatsapp/connect
// ---------------------------------------------------------------------------

describe('POST /whatsapp/connect', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/whatsapp/connect' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — returnează QR code', async () => {
    const token = await registerAndLogin('wa-connect-ok@example.com')
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/connect',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().qrCode).toBe('data:image/png;base64,MOCKQR==')
  })

  it('200 — sesiunea e salvată în DB cu status pairing', async () => {
    const token = await registerAndLogin('wa-connect-db@example.com')
    await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/connect',
      headers: { authorization: `Bearer ${token}` },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/whatsapp/session',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const { session } = res.json()
    expect(session).not.toBeNull()
    expect(session.status).toBe('pairing')
  })
})

// ---------------------------------------------------------------------------
// POST /whatsapp/disconnect
// ---------------------------------------------------------------------------

describe('POST /whatsapp/disconnect', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/whatsapp/disconnect' })
    expect(res.statusCode).toBe(401)
  })

  it('404 — fără sesiune existentă', async () => {
    const token = await registerAndLogin('wa-disconnect-nosession@example.com')
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/disconnect',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('200 — deconectează sesiunea existentă', async () => {
    const token = await registerAndLogin('wa-disconnect-ok@example.com')
    await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/connect',
      headers: { authorization: `Bearer ${token}` },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/disconnect',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })
})
