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
    customers: { create: vi.fn().mockResolvedValue({ id: 'cus_test' }) },
    checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }) } },
    billingPortal: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/test' }) } },
  },
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
// Helpers
// ---------------------------------------------------------------------------

async function registerAndLogin(email = 'aiuser@test.com') {
  vi.mocked(sendVerificationEmail).mockClear()
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { name: 'AI User', email, password: 'Password123!' },
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
// GET /ai/settings
// ---------------------------------------------------------------------------

describe('GET /ai/settings', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/ai/settings' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — returnează setările implicite (auto-create)', async () => {
    const token = await registerAndLogin('settings-get@test.com')
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const { settings } = res.json()
    expect(settings.isActive).toBe(false)
    expect(settings.adminDisabled).toBe(false)
    expect(settings.timerMinutes).toBe(5)
    expect(typeof settings.systemPrompt).toBe('string')
    expect(settings.systemPrompt.length).toBeGreaterThan(0)
  })

  it('200 — apeluri consecutive returnează același record', async () => {
    const token = await registerAndLogin('settings-idempotent@test.com')
    const res1 = await app.inject({
      method: 'GET', url: '/api/v1/ai/settings',
      headers: { authorization: `Bearer ${token}` },
    })
    const res2 = await app.inject({
      method: 'GET', url: '/api/v1/ai/settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res1.json().settings.id).toBe(res2.json().settings.id)
  })
})

// ---------------------------------------------------------------------------
// PATCH /ai/settings
// ---------------------------------------------------------------------------

describe('PATCH /ai/settings', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/ai/settings',
      payload: { isActive: true },
    })
    expect(res.statusCode).toBe(401)
  })

  it('200 — activează agentul', async () => {
    const token = await registerAndLogin('settings-activate@test.com')
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/ai/settings',
      payload: { isActive: true },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().settings.isActive).toBe(true)
  })

  it('200 — dezactivează agentul', async () => {
    const token = await registerAndLogin('settings-deactivate@test.com')
    await app.inject({
      method: 'PATCH', url: '/api/v1/ai/settings',
      payload: { isActive: true },
      headers: { authorization: `Bearer ${token}` },
    })
    const res = await app.inject({
      method: 'PATCH', url: '/api/v1/ai/settings',
      payload: { isActive: false },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().settings.isActive).toBe(false)
  })

  it('200 — schimbă timerMinutes', async () => {
    const token = await registerAndLogin('settings-timer@test.com')
    const res = await app.inject({
      method: 'PATCH', url: '/api/v1/ai/settings',
      payload: { timerMinutes: 15 },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().settings.timerMinutes).toBe(15)
  })

  it('400 — timerMinutes sub 1 respins', async () => {
    const token = await registerAndLogin('settings-timer-invalid@test.com')
    const res = await app.inject({
      method: 'PATCH', url: '/api/v1/ai/settings',
      payload: { timerMinutes: 0 },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('400 — timerMinutes peste 60 respins', async () => {
    const token = await registerAndLogin('settings-timer-over@test.com')
    const res = await app.inject({
      method: 'PATCH', url: '/api/v1/ai/settings',
      payload: { timerMinutes: 61 },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('200 — schimbă systemPrompt', async () => {
    const token = await registerAndLogin('settings-prompt@test.com')
    const newPrompt = 'Ești un asistent prietenos care răspunde în română.'
    const res = await app.inject({
      method: 'PATCH', url: '/api/v1/ai/settings',
      payload: { systemPrompt: newPrompt },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().settings.systemPrompt).toBe(newPrompt)
  })

  // systemPrompt nu mai are min (un prompt scurt sau gol e permis → fallback pe DEFAULT_PROMPT
  // în message.handler). Singura constrângere rămasă e max(2000), ca plafon anti-DoS.
  it('200 — systemPrompt scurt e acceptat (fără min)', async () => {
    const token = await registerAndLogin('settings-prompt-short@test.com')
    const res = await app.inject({
      method: 'PATCH', url: '/api/v1/ai/settings',
      payload: { systemPrompt: 'scurt' },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
  })

  it('400 — systemPrompt prea lung (>2000)', async () => {
    const token = await registerAndLogin('settings-prompt-long@test.com')
    const res = await app.inject({
      method: 'PATCH', url: '/api/v1/ai/settings',
      payload: { systemPrompt: 'x'.repeat(2001) },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('200 — patch parțial (doar un câmp) nu alterează celelalte', async () => {
    const token = await registerAndLogin('settings-partial@test.com')
    await app.inject({
      method: 'PATCH', url: '/api/v1/ai/settings',
      payload: { timerMinutes: 10 },
      headers: { authorization: `Bearer ${token}` },
    })
    const res = await app.inject({
      method: 'PATCH', url: '/api/v1/ai/settings',
      payload: { isActive: true },
      headers: { authorization: `Bearer ${token}` },
    })
    const { settings } = res.json()
    expect(settings.isActive).toBe(true)
    expect(settings.timerMinutes).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// GET /ai/blacklist
// ---------------------------------------------------------------------------

describe('GET /ai/blacklist', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/ai/blacklist' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — lista goală inițial', async () => {
    const token = await registerAndLogin('blacklist-get@test.com')
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/blacklist',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().phones).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// POST /ai/blacklist
// ---------------------------------------------------------------------------

describe('POST /ai/blacklist', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/blacklist',
      payload: { phoneNumber: '40758154490' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('201 — adaugă număr valid', async () => {
    const token = await registerAndLogin('blacklist-add@test.com')
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/blacklist',
      payload: { phoneNumber: '+40758154490' },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().ok).toBe(true)
  })

  it('201 — numărul apare în GET blacklist', async () => {
    const token = await registerAndLogin('blacklist-verify@test.com')
    await app.inject({
      method: 'POST', url: '/api/v1/ai/blacklist',
      payload: { phoneNumber: '40758154490' },
      headers: { authorization: `Bearer ${token}` },
    })
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/blacklist',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.json().phones).toContain('40758154490')
  })

  it('400 — număr prea scurt', async () => {
    const token = await registerAndLogin('blacklist-short@test.com')
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/blacklist',
      payload: { phoneNumber: '123' },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('201 — duplicate ignorat (onConflictDoNothing)', async () => {
    const token = await registerAndLogin('blacklist-dup@test.com')
    await app.inject({
      method: 'POST', url: '/api/v1/ai/blacklist',
      payload: { phoneNumber: '40758154490' },
      headers: { authorization: `Bearer ${token}` },
    })
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/blacklist',
      payload: { phoneNumber: '40758154490' },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(201)
    const listRes = await app.inject({
      method: 'GET', url: '/api/v1/ai/blacklist',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(listRes.json().phones.filter((p: string) => p === '40758154490').length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// DELETE /ai/blacklist/:phone
// ---------------------------------------------------------------------------

describe('DELETE /ai/blacklist/:phone', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/v1/ai/blacklist/40758154490' })
    expect(res.statusCode).toBe(401)
  })

  it('204 — șterge numărul din blacklist', async () => {
    const token = await registerAndLogin('blacklist-delete@test.com')
    await app.inject({
      method: 'POST', url: '/api/v1/ai/blacklist',
      payload: { phoneNumber: '40758154490' },
      headers: { authorization: `Bearer ${token}` },
    })
    const res = await app.inject({
      method: 'DELETE', url: '/api/v1/ai/blacklist/40758154490',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(204)

    const listRes = await app.inject({
      method: 'GET', url: '/api/v1/ai/blacklist',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(listRes.json().phones).not.toContain('40758154490')
  })

  it('204 — ștergere număr inexistent nu dă eroare', async () => {
    const token = await registerAndLogin('blacklist-delete-missing@test.com')
    const res = await app.inject({
      method: 'DELETE', url: '/api/v1/ai/blacklist/99999999999',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(204)
  })
})

// ---------------------------------------------------------------------------
// GET /ai/conversations
// ---------------------------------------------------------------------------

describe('GET /ai/conversations', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/ai/conversations' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — lista goală inițial', async () => {
    const token = await registerAndLogin('conv-empty@test.com')
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/conversations',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().conversations).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// GET /ai/conversations/:phone
// ---------------------------------------------------------------------------

describe('GET /ai/conversations/:phone', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/ai/conversations/40758154490' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — returnează array gol pentru contact fără mesaje', async () => {
    const token = await registerAndLogin('conv-phone-empty@test.com')
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/conversations/40758154490',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().messages).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// DELETE /ai/conversations/:phone
// ---------------------------------------------------------------------------

describe('DELETE /ai/conversations/:phone', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/v1/ai/conversations/40758154490' })
    expect(res.statusCode).toBe(401)
  })

  it('204 — șterge istoricul (chiar dacă nu există mesaje)', async () => {
    const token = await registerAndLogin('conv-delete@test.com')
    const res = await app.inject({
      method: 'DELETE', url: '/api/v1/ai/conversations/40758154490',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(204)
  })
})

// ---------------------------------------------------------------------------
// Currency (PATCH /ai/settings)
// ---------------------------------------------------------------------------

describe('PATCH /ai/settings — currency', () => {
  it('200 — default RON', async () => {
    const token = await registerAndLogin('currency-default@test.com')
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.json().settings.currency).toBe('RON')
  })

  it('200 — schimbă în EUR', async () => {
    const token = await registerAndLogin('currency-eur@test.com')
    const res = await app.inject({
      method: 'PATCH', url: '/api/v1/ai/settings',
      payload: { currency: 'EUR' },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().settings.currency).toBe('EUR')
  })

  it('400 — monedă neacceptată respinsă', async () => {
    const token = await registerAndLogin('currency-bad@test.com')
    const res = await app.inject({
      method: 'PATCH', url: '/api/v1/ai/settings',
      payload: { currency: 'JPY' },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('200 — salvează leadCriteria', async () => {
    const token = await registerAndLogin('lead-criteria@test.com')
    const res = await app.inject({
      method: 'PATCH', url: '/api/v1/ai/settings',
      payload: { leadCriteria: 'Un lead bun întreabă de preț și livrare.' },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().settings.leadCriteria).toContain('preț')
  })
})

// ---------------------------------------------------------------------------
// Lead-uri (GET /ai/leads, POST /ai/leads/analyze)
// ---------------------------------------------------------------------------

describe('GET /ai/leads', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/ai/leads' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — listă goală pentru user fără conversații', async () => {
    const token = await registerAndLogin('leads-empty@test.com')
    const res = await app.inject({
      method: 'GET', url: '/api/v1/ai/leads',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().leads).toEqual([])
  })
})

describe('POST /ai/leads/analyze', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/ai/leads/analyze', payload: {} })
    expect(res.statusCode).toBe(401)
  })

  it('200 — lot gol (fără contacte) returnează analyzed:0, fără apel LLM', async () => {
    const token = await registerAndLogin('leads-analyze-empty@test.com')
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/leads/analyze',
      payload: {},
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().analyzed).toBe(0)
  })

  it('400 — phone invalid (prea scurt) respins', async () => {
    const token = await registerAndLogin('leads-analyze-badphone@test.com')
    const res = await app.inject({
      method: 'POST', url: '/api/v1/ai/leads/analyze',
      payload: { phone: '123' },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
  })
})
