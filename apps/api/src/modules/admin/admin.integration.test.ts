import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { generate as generateTotp, generateSecret } from 'otplib'
import { buildApp } from '../../app.js'
import { env } from '../../config/env.js'

const ADMIN_SECRET = 'test_admin_secret_minimum_32_chars_here'
// Bearer-ul e un token de sesiune semnat, emis de POST /admin/auth — nu secretul brut.
// Se populează în beforeAll, după ce app e gata.
let ADMIN_TOKEN = ''

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

vi.mock('../whatsapp/whatsapp.session-manager.js', () => ({
  disconnectSession: vi.fn().mockResolvedValue(undefined),
  restoreAllSessions: vi.fn().mockResolvedValue(undefined),
  getActiveSocket: vi.fn().mockReturnValue(undefined),
}))

import { sendVerificationEmail } from '../../utils/email.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
  const authRes = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/auth',
    payload: { secret: ADMIN_SECRET },
  })
  ADMIN_TOKEN = `Bearer ${authRes.json().token}`
})

afterAll(async () => {
  await app.close()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function registerAndLogin(email = 'user@test.com') {
  vi.mocked(sendVerificationEmail).mockClear()
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { name: 'Test User', email, password: 'Password123!' },
  })
  const [, , token] = vi.mocked(sendVerificationEmail).mock.calls[0] as [string, string, string]
  await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token } })
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'Password123!' },
  })
  return res.json() as { accessToken: string; user: { id: string; email: string } }
}

async function getUserId(email: string): Promise<string> {
  const usersRes = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/users',
    headers: { authorization: ADMIN_TOKEN },
  })
  const { users } = usersRes.json()
  return users.find((u: any) => u.email === email)?.id
}

// ---------------------------------------------------------------------------
// POST /admin/auth
// ---------------------------------------------------------------------------

describe('POST /admin/auth', () => {
  it('200 — secret corect returnează token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth',
      payload: { secret: ADMIN_SECRET },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(typeof res.json().token).toBe('string')
  })

  it('401 — secret greșit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth',
      payload: { secret: 'wrong_secret' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('401 — fără secret', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth',
      payload: {},
    })
    expect(res.statusCode).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// POST /admin/auth — 2FA (TOTP)
// Activă DOAR când env.ADMIN_TOTP_SECRET e setat. Aici îl setăm la runtime ca să exersăm calea 2FA,
// apoi îl resetăm ca celelalte teste să rămână pe fluxul fără 2FA (back-compat).
// ---------------------------------------------------------------------------

describe('POST /admin/auth — 2FA (TOTP)', () => {
  const TOTP_SECRET = generateSecret()

  beforeAll(() => { env.ADMIN_TOTP_SECRET = TOTP_SECRET })
  afterAll(() => { env.ADMIN_TOTP_SECRET = undefined })

  it('401 — secret corect dar fără cod 2FA când TOTP e activ', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth',
      payload: { secret: ADMIN_SECRET },
    })
    expect(res.statusCode).toBe(401)
  })

  it('401 — cod 2FA greșit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth',
      payload: { secret: ADMIN_SECRET, totp: '000000' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('200 — secret corect + cod 2FA valid returnează token', async () => {
    const code = await generateTotp({ secret: TOTP_SECRET })
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth',
      payload: { secret: ADMIN_SECRET, totp: code },
    })
    expect(res.statusCode).toBe(200)
    expect(typeof res.json().token).toBe('string')
  })

  it('401 — secret greșit este respins înainte de 2FA', async () => {
    const code = await generateTotp({ secret: TOTP_SECRET })
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth',
      payload: { secret: 'wrong_secret', totp: code },
    })
    expect(res.statusCode).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// GET /admin/users
// ---------------------------------------------------------------------------

describe('GET /admin/users', () => {
  it('401 — fără token admin', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/users' })
    expect(res.statusCode).toBe(401)
  })

  it('401 — token greșit', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      headers: { authorization: 'Bearer wrong_token_here' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('200 — returnează lista goală inițial', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json().users)).toBe(true)
  })

  it('200 — include userii înregistrați', async () => {
    await registerAndLogin('listed@test.com')
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    const { users } = res.json()
    expect(users.some((u: any) => u.email === 'listed@test.com')).toBe(true)
  })

  it('200 — câmpurile necesare sunt prezente', async () => {
    await registerAndLogin('fields@test.com')
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      headers: { authorization: ADMIN_TOKEN },
    })
    const user = res.json().users.find((u: any) => u.email === 'fields@test.com')
    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('name')
    expect(user).toHaveProperty('email')
    expect(user).toHaveProperty('createdAt')
    // JOIN fields (pot fi null dacă nu există)
    expect(Object.keys(user)).toContain('subscriptionStatus')
    expect(Object.keys(user)).toContain('sessionStatus')
    expect(Object.keys(user)).toContain('agentActive')
  })
})

// ---------------------------------------------------------------------------
// GET /admin/stats
// ---------------------------------------------------------------------------

describe('GET /admin/stats', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/stats' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — returnează structura corectă', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/stats',
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    const stats = res.json()
    expect(stats).toHaveProperty('totalUsers')
    expect(stats).toHaveProperty('activeSubscribers')
    expect(stats).toHaveProperty('inTrial')
    expect(stats).toHaveProperty('pastDue')
    expect(stats).toHaveProperty('activeAgents')
    expect(stats).toHaveProperty('mrr')
    expect(stats).toHaveProperty('conversionRate')
    expect(stats).toHaveProperty('newThisMonth')
    expect(stats).toHaveProperty('connectedWhatsapp')
    expect(stats).toHaveProperty('pairingWhatsapp')
    expect(stats).toHaveProperty('disconnectedWhatsapp')
    expect(stats).toHaveProperty('activeAgentsWithoutWhatsapp')
    expect(stats).toHaveProperty('trialsExpiringSoon')
    expect(stats).toHaveProperty('cancelingSubscriptions')
    expect(stats).toHaveProperty('monthlySubscribers')
    expect(stats).toHaveProperty('annualSubscribers')
    expect(stats).toHaveProperty('messagesToday')
    expect(stats).toHaveProperty('aiMessagesToday')
    expect(stats).toHaveProperty('ownerMessagesToday')
    expect(stats).toHaveProperty('totalConversations')
  })

  it('200 — totalUsers crește după înregistrare', async () => {
    const before = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/stats',
      headers: { authorization: ADMIN_TOKEN },
    })
    const totalBefore = before.json().totalUsers

    await registerAndLogin('stats@test.com')

    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/stats',
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(after.json().totalUsers).toBe(totalBefore + 1)
  })
})

// ---------------------------------------------------------------------------
// PATCH /admin/users/:userId/agent
// ---------------------------------------------------------------------------

describe('PATCH /admin/users/:userId/agent', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/users/fake-id/agent',
      payload: { isActive: true },
    })
    expect(res.statusCode).toBe(401)
  })

  it('200 — dezactivează agentul și setează adminDisabled', async () => {
    await registerAndLogin('agent-toggle@test.com')
    const userId = await getUserId('agent-toggle@test.com')

    // Creăm ai_settings prin GET /ai/settings (auto-create)
    await app.inject({
      method: 'GET',
      url: '/api/v1/ai/settings',
      headers: { authorization: `Bearer placeholder` },
    })

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${userId}/agent`,
      payload: { isActive: false },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// POST /admin/users/:userId/extend-trial
// ---------------------------------------------------------------------------

describe('POST /admin/users/:userId/extend-trial', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users/fake-id/extend-trial',
      payload: { days: 7 },
    })
    expect(res.statusCode).toBe(401)
  })

  it('400 — zile invalide (0)', async () => {
    await registerAndLogin('extend-invalid@test.com')
    const userId = await getUserId('extend-invalid@test.com')
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${userId}/extend-trial`,
      payload: { days: 0 },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(400)
  })

  it('400 — zile invalide (>365)', async () => {
    await registerAndLogin('extend-over@test.com')
    const userId = await getUserId('extend-over@test.com')
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${userId}/extend-trial`,
      payload: { days: 400 },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(400)
  })

  it('200 — zile valide (user fără subscripție → silențios OK)', async () => {
    await registerAndLogin('extend-ok@test.com')
    const userId = await getUserId('extend-ok@test.com')
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${userId}/extend-trial`,
      payload: { days: 7 },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DELETE /admin/users/:userId
// ---------------------------------------------------------------------------

describe('DELETE /admin/users/:userId', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/admin/users/fake-id',
    })
    expect(res.statusCode).toBe(401)
  })

  it('200 — șterge userul și dispare din listă', async () => {
    await registerAndLogin('todelete@test.com')
    const userId = await getUserId('todelete@test.com')

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/users/${userId}`,
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      headers: { authorization: ADMIN_TOKEN },
    })
    const { users } = listRes.json()
    expect(users.find((u: any) => u.id === userId)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// POST /admin/users/:userId/email
// ---------------------------------------------------------------------------

describe('POST /admin/users/:userId/email', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users/fake-id/email',
      payload: { subject: 'Test', body: 'Body' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('400 — subiect lipsă', async () => {
    await registerAndLogin('email-missing@test.com')
    const userId = await getUserId('email-missing@test.com')
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${userId}/email`,
      payload: { subject: '', body: 'Body' },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(400)
  })

  it('400 — body lipsă', async () => {
    await registerAndLogin('email-no-body@test.com')
    const userId = await getUserId('email-no-body@test.com')
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${userId}/email`,
      payload: { subject: 'Test', body: '' },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(400)
  })

  it('200 — trimite email cu date valide', async () => {
    await registerAndLogin('email-ok@test.com')
    const userId = await getUserId('email-ok@test.com')
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${userId}/email`,
      payload: { subject: 'Subiect test', body: 'Corpul mesajului de test' },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })

  it('404 — userId inexistent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users/nonexistent-id/email',
      payload: { subject: 'Test', body: 'Body' },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// POST /admin/users/:userId/disconnect-wa
// ---------------------------------------------------------------------------

describe('POST /admin/users/:userId/disconnect-wa', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users/fake-id/disconnect-wa',
    })
    expect(res.statusCode).toBe(401)
  })

  it('200 — returnează ok (chiar dacă sesiunea nu există)', async () => {
    await registerAndLogin('disconnect@test.com')
    const userId = await getUserId('disconnect@test.com')
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${userId}/disconnect-wa`,
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// GET /admin/notifications
// ---------------------------------------------------------------------------

describe('GET /admin/notifications', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/notifications' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — returnează structura corectă', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/notifications',
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('notifications')
    expect(res.json()).toHaveProperty('unreadCount')
    expect(Array.isArray(res.json().notifications)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// POST /admin/notifications/read
// ---------------------------------------------------------------------------

describe('POST /admin/notifications/read', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/admin/notifications/read' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — marchează ca citite', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/notifications/read',
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DELETE /admin/notifications
// ---------------------------------------------------------------------------

describe('DELETE /admin/notifications', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/v1/admin/notifications' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — șterge toate notificările adminului', async () => {
    await registerAndLogin('admin@test.example.com')
    await registerAndLogin('notify-clear@test.com')

    const before = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/notifications',
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(before.json().notifications.length).toBeGreaterThan(0)

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/admin/notifications',
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)

    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/notifications',
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(after.json().notifications).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// DELETE /admin/notifications/:notificationId
// ---------------------------------------------------------------------------

describe('DELETE /admin/notifications/:notificationId', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/v1/admin/notifications/fake-id' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — șterge o singură notificare', async () => {
    await registerAndLogin('admin@test.example.com')
    await registerAndLogin('notify-one@test.com')

    const before = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/notifications',
      headers: { authorization: ADMIN_TOKEN },
    })
    const notification = before.json().notifications[0]
    expect(notification).toBeTruthy()

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/notifications/${notification.id}`,
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)

    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/notifications',
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(after.json().notifications.some((n: any) => n.id === notification.id)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// GET /admin/config
// ---------------------------------------------------------------------------

describe('GET /admin/config', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/config' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — returnează obiect (gol inițial)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/config',
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(typeof res.json().config).toBe('object')
  })
})

// ---------------------------------------------------------------------------
// PATCH /admin/config
// ---------------------------------------------------------------------------

describe('PATCH /admin/config', () => {
  it('401 — fără token', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/config',
      payload: { defaultPrompt: 'test' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('200 — salvează și regăsește configurarea', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/config',
      payload: { default_system_prompt: 'Prompt de test' },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/config',
      headers: { authorization: ADMIN_TOKEN },
    })
    const { config } = getRes.json()
    expect(config.default_system_prompt).toBe('Prompt de test')
  })

  it('400 — cheie nepermisă (whitelist M5/L4)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/config',
      payload: { default_system_prompt: 'ok', cheie_arbitrara: 'junk' },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(400)
  })

  it('200 — suprascrie o valoare existentă', async () => {
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/config',
      payload: { default_system_prompt: 'initial' },
      headers: { authorization: ADMIN_TOKEN },
    })
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/config',
      payload: { default_system_prompt: 'updated' },
      headers: { authorization: ADMIN_TOKEN },
    })
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/config',
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(getRes.json().config.default_system_prompt).toBe('updated')
  })
})
