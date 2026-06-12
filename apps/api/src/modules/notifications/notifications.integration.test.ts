import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'

const ADMIN_SECRET = 'test_admin_secret_minimum_32_chars_here'
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

async function registerAndLogin(email: string) {
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
  return usersRes.json().users.find((u: any) => u.email === email)?.id
}

describe('GET /notifications', () => {
  it('401 — fără autentificare', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/notifications' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — user nou: listă goală, 0 necitite', async () => {
    const { accessToken } = await registerAndLogin('notif-empty@test.com')
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().notifications).toEqual([])
    expect(res.json().unreadCount).toBe(0)
  })
})

describe('B15 — extinderea trial-ului creează notificare pentru user', () => {
  it('userul vede notificarea „trial_extended" ca necitită, apoi o poate marca citită', async () => {
    const { accessToken } = await registerAndLogin('notif-trial@test.com')
    const userId = await getUserId('notif-trial@test.com')

    // Admin extinde trial-ul
    const extend = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${userId}/extend-trial`,
      payload: { days: 7 },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(extend.statusCode).toBe(200)

    // Userul vede notificarea ca necitită
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(list.statusCode).toBe(200)
    const body = list.json()
    expect(body.unreadCount).toBe(1)
    expect(body.notifications).toHaveLength(1)
    expect(body.notifications[0].type).toBe('trial_extended')
    expect(body.notifications[0].readAt).toBeNull()

    // Marchează tot citit
    const read = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/read',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    })
    expect(read.statusCode).toBe(200)

    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(after.json().unreadCount).toBe(0)
    expect(after.json().notifications[0].readAt).not.toBeNull()
  })

  it('IDOR — notificarea unui user NU apare la alt user', async () => {
    const { accessToken: tokenA } = await registerAndLogin('notif-a@test.com')
    const userIdA = await getUserId('notif-a@test.com')
    const { accessToken: tokenB } = await registerAndLogin('notif-b@test.com')

    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${userIdA}/extend-trial`,
      payload: { days: 3 },
      headers: { authorization: ADMIN_TOKEN },
    })

    // User B nu vede notificarea lui A
    const listB = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${tokenB}` },
    })
    expect(listB.json().notifications.some((n: any) => n.type === 'trial_extended')).toBe(false)

    // User A o vede
    const listA = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${tokenA}` },
    })
    expect(listA.json().notifications.some((n: any) => n.type === 'trial_extended')).toBe(true)
  })
})

describe('4584 — separare notificări admin vs user (audience)', () => {
  it('contul de admin NU vede notificările operaționale de admin în clopoțelul user; panoul admin le vede', async () => {
    // Contul de admin e și user normal (email = ADMIN_EMAIL din vitest.config). Notificările de
    // admin (new_user) se stochează sub acest user, dar cu audience='admin' → nu trebuie să apară
    // în ruta user-facing /notifications.
    const { accessToken: adminUserToken } = await registerAndLogin('admin@test.example.com')

    // Înregistrarea altui user declanșează notifyAdmin('new_user') către contul de admin.
    await registerAndLogin('triggers-new-user@test.com')

    // Clopoțelul user al contului de admin NU conține new_user
    const userBell = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${adminUserToken}` },
    })
    expect(userBell.statusCode).toBe(200)
    expect(userBell.json().notifications.some((n: any) => n.type === 'new_user')).toBe(false)

    // Panoul admin DA conține new_user
    const adminBell = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/notifications',
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(adminBell.statusCode).toBe(200)
    expect(adminBell.json().notifications.some((n: any) => n.type === 'new_user')).toBe(true)
  })
})
