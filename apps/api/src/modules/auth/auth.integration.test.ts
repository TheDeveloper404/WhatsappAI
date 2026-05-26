import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'

vi.mock('../../utils/email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendAdminNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendCustomEmail: vi.fn().mockResolvedValue(undefined),
}))

// Import after mock so the service uses the mocked version
import { sendVerificationEmail, sendPasswordResetEmail } from '../../utils/email.js'

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

async function register(overrides: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      name: 'Test User',
      email: 'user@example.com',
      password: 'Password123!',
      ...overrides,
    },
  })
}

async function registerAndVerify(email = 'user@example.com') {
  vi.mocked(sendVerificationEmail).mockClear()
  await register({ email })
  const [, , token] = vi.mocked(sendVerificationEmail).mock.calls[0] as [string, string, string]
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/verify-email',
    payload: { token },
  })
  return { email, password: 'Password123!' }
}

async function login(email: string, password: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  })
}

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------

describe('POST /auth/register', () => {
  it('201 — registers a new user and sends verification email', async () => {
    const res = await register()
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.user.email).toBe('user@example.com')
    expect(body.user).not.toHaveProperty('passwordHash')
    expect(sendVerificationEmail).toHaveBeenCalledOnce()
  })

  it('409 — duplicate email returns generic error (no user enumeration)', async () => {
    await register()
    const res2 = await register()
    expect(res2.statusCode).toBe(409)
  })

  it('400 — weak password rejected', async () => {
    const res = await register({ password: '123' })
    expect(res.statusCode).toBe(400)
  })

  it('400 — invalid email rejected', async () => {
    const res = await register({ email: 'not-an-email' })
    expect(res.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// POST /auth/verify-email
// ---------------------------------------------------------------------------

describe('POST /auth/verify-email', () => {
  it('200 — valid token verifies the email', async () => {
    vi.mocked(sendVerificationEmail).mockClear()
    await register()
    const [, , token] = vi.mocked(sendVerificationEmail).mock.calls[0] as [string, string, string]
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token },
    })
    expect(res.statusCode).toBe(200)
  })

  it('422 — invalid token returns error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: 'invalid-token' },
    })
    expect(res.statusCode).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

describe('POST /auth/login', () => {
  it('200 — returns accessToken and sets cookie after verified login', async () => {
    const { email, password } = await registerAndVerify()
    const res = await login(email, password)
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.accessToken).toBeDefined()
    expect(res.headers['set-cookie']).toMatch(/refreshToken=/)
  })

  it('401 — wrong password', async () => {
    const { email } = await registerAndVerify()
    const res = await login(email, 'WrongPassword!')
    expect(res.statusCode).toBe(401)
  })

  it('403 — unverified email blocked', async () => {
    await register({ email: 'unverified@example.com' })
    const res = await login('unverified@example.com', 'Password123!')
    expect(res.statusCode).toBe(403)
  })

  it('401 — non-existent email returns same 401 (no enumeration)', async () => {
    const res = await login('nobody@example.com', 'Password123!')
    expect(res.statusCode).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// POST /auth/refresh
// ---------------------------------------------------------------------------

describe('POST /auth/refresh', () => {
  it('200 — issues new tokens and rotates cookie', async () => {
    const { email, password } = await registerAndVerify()
    const loginRes = await login(email, password)
    const cookie = loginRes.headers['set-cookie'] as string

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().accessToken).toBeDefined()
    expect(res.headers['set-cookie']).toMatch(/refreshToken=/)
  })

  it('401 — no cookie returns error', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh' })
    expect(res.statusCode).toBe(401)
  })

  it('401 — reused refresh token rejected (rotation)', async () => {
    const { email, password } = await registerAndVerify('rotate@example.com')
    const loginRes = await login(email, password)
    const cookie = loginRes.headers['set-cookie'] as string

    await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie } })
    // second use of same token should fail
    const res2 = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie } })
    expect(res2.statusCode).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------

describe('POST /auth/logout', () => {
  it('204 — clears cookie', async () => {
    const { email, password } = await registerAndVerify('logout@example.com')
    const loginRes = await login(email, password)
    const cookie = loginRes.headers['set-cookie'] as string

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(204)
  })
})

// ---------------------------------------------------------------------------
// POST /auth/forgot-password
// ---------------------------------------------------------------------------

describe('POST /auth/forgot-password', () => {
  it('200 — always returns success regardless of email existence', async () => {
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: 'nobody@example.com' },
    })
    expect(res1.statusCode).toBe(200)

    await registerAndVerify('real@example.com')
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: 'real@example.com' },
    })
    expect(res2.statusCode).toBe(200)
    expect(sendPasswordResetEmail).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// POST /auth/reset-password
// ---------------------------------------------------------------------------

describe('POST /auth/reset-password', () => {
  it('200 — resets password with valid token', async () => {
    vi.mocked(sendPasswordResetEmail).mockClear()
    const { email } = await registerAndVerify('reset@example.com')

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email },
    })

    const [, rawToken] = vi.mocked(sendPasswordResetEmail).mock.calls[0] as [string, string]

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: rawToken, password: 'NewPassword123!' },
    })
    expect(res.statusCode).toBe(200)

    // Old password no longer works
    const loginOld = await login(email, 'Password123!')
    expect(loginOld.statusCode).toBe(401)

    // New password works
    const loginNew = await login(email, 'NewPassword123!')
    expect(loginNew.statusCode).toBe(200)
  })

  it('422 — invalid reset token rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: 'invalid', password: 'NewPassword123!' },
    })
    expect(res.statusCode).toBe(422)
  })
})
