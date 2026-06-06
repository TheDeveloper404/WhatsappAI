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

import { sendVerificationEmail, sendAccountDeletionEmail } from '../../utils/email.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

async function registerAndLogin(email = 'me@example.com') {
  vi.mocked(sendVerificationEmail).mockClear()
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { name: 'Test User', email, password: 'Password123!' },
  })
  const [, , token] = vi.mocked(sendVerificationEmail).mock.calls[0] as [string, string, string]
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/verify-email',
    payload: { token },
  })
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'Password123!' },
  })
  return {
    accessToken: loginRes.json().accessToken as string,
    email,
  }
}

describe('GET /users/me', () => {
  it('200 — returns authenticated user profile', async () => {
    const { accessToken, email } = await registerAndLogin()
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.email).toBe(email)
    expect(body.emailVerified).toBe(true)
    expect(body).not.toHaveProperty('passwordHash')
  })

  it('401 — no token rejected', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/users/me' })
    expect(res.statusCode).toBe(401)
  })

  it('401 — invalid token rejected', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: 'Bearer invalid.token.here' },
    })
    expect(res.statusCode).toBe(401)
  })
})

// Ștergerea contului e în doi pași (double opt-in pe email): deletion-request (autentificat,
// cere parola, trimite linkul) + deletion-confirm (token din email, șterge definitiv).
describe('POST /users/me/deletion-request', () => {
  it('401 — no token rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/deletion-request',
      payload: { password: 'Password123!' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('400 — missing password rejected', async () => {
    const { accessToken } = await registerAndLogin('del-nopass@example.com')
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/deletion-request',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('401 — wrong password rejected', async () => {
    const { accessToken } = await registerAndLogin('del-wrongpass@example.com')
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/deletion-request',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { password: 'GreșităTotal1!' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('200 — parola corectă trimite linkul, dar NU șterge încă contul', async () => {
    vi.mocked(sendAccountDeletionEmail).mockClear()
    const { accessToken } = await registerAndLogin('del-request@example.com')
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/deletion-request',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { password: 'Password123!' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    // Emailul de confirmare a fost trimis cu un token.
    expect(sendAccountDeletionEmail).toHaveBeenCalledOnce()
    const [, , token] = vi.mocked(sendAccountDeletionEmail).mock.calls[0] as [string, string, string]
    expect(token).toBeTruthy()
    // Contul ÎNCĂ există — ștergerea nu e finalizată până la confirmare.
    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(after.statusCode).toBe(200)
  })
})

describe('POST /users/me/deletion-confirm', () => {
  it('400 — missing token rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/deletion-confirm',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('422 — invalid token rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/deletion-confirm',
      payload: { token: 'token-care-nu-exista' },
    })
    expect(res.statusCode).toBe(422)
  })

  it('200 — token valid șterge contul definitiv', async () => {
    vi.mocked(sendAccountDeletionEmail).mockClear()
    const { accessToken } = await registerAndLogin('del-confirm@example.com')
    await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/deletion-request',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { password: 'Password123!' },
    })
    const [, , token] = vi.mocked(sendAccountDeletionEmail).mock.calls[0] as [string, string, string]

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/deletion-confirm',
      payload: { token },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)

    // Contul a dispărut: vechiul access token nu mai e valid (cont inexistent → 401).
    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(after.statusCode).toBe(401)

    // Token single-use: a doua confirmare cu același token e respinsă.
    const reuse = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/deletion-confirm',
      payload: { token },
    })
    expect(reuse.statusCode).toBe(422)
  })
})
