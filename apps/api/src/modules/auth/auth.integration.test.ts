import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'

vi.mock('../../utils/email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendAdminNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendCustomEmail: vi.fn().mockResolvedValue(undefined),
  // M8: pe ramura „email deja înregistrat" serviciul trimite acest email în loc de cel de verificare.
  // Fără el în mock, apelul pe modulul mock-uit ar fi `undefined()` → aruncă sincron → 500.
  sendAlreadyRegisteredEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../utils/turnstile.js', () => ({
  // Mock anti-bot (0.7): token === 'valid-token' trece; orice altceva (inclusiv lipsă) pică.
  // Evită apelul real la Cloudflare în teste.
  verifyTurnstile: vi.fn(async (_secret: string, token?: string) => token === 'valid-token'),
}))

// Import after mock so the service uses the mocked version
import { sendVerificationEmail, sendPasswordResetEmail, sendAlreadyRegisteredEmail } from '../../utils/email.js'
import { env } from '../../config/env.js'
import { db } from '../../config/database.js'
import { refreshTokens } from '../../db/schema.js'
import { and, eq, isNotNull } from 'drizzle-orm'

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
    vi.mocked(sendVerificationEmail).mockClear()
    const res = await register()
    expect(res.statusCode).toBe(201)
    const body = res.json()
    // M8 (anti-enumerare): răspunsul e generic, NU expune obiectul user (nici email, nici hash).
    expect(body).not.toHaveProperty('user')
    expect(typeof body.message).toBe('string')
    expect(sendVerificationEmail).toHaveBeenCalledOnce()
  })

  it('201 — duplicate email returns identical generic response (no user enumeration)', async () => {
    vi.mocked(sendVerificationEmail).mockClear()
    vi.mocked(sendAlreadyRegisteredEmail).mockClear()

    const res1 = await register()
    const res2 = await register()

    // M8: ambele cereri întorc EXACT același 201 + corp generic, indiferent că al doilea email
    // are deja cont — un atacator nu poate distinge un email existent de unul nou.
    expect(res2.statusCode).toBe(res1.statusCode)
    expect(res2.statusCode).toBe(201)
    expect(res2.json()).toEqual(res1.json())

    // Iar pe ramura duplicat NU se creează cont nou: un singur email de verificare (la prima cerere),
    // a doua oară pleacă un email „ai deja cont".
    expect(sendVerificationEmail).toHaveBeenCalledOnce()
    expect(sendAlreadyRegisteredEmail).toHaveBeenCalledOnce()
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
// POST /auth/login — challenge Turnstile după N eșecuri (0.7, anti account-lockout DoS)
// ---------------------------------------------------------------------------

describe('POST /auth/login — captcha după N eșecuri (Turnstile activ)', () => {
  // ATENȚIE: `/register` gateează ȘI el pe TURNSTILE_SECRET. Deci creăm userul cu Turnstile OPRIT
  // (registerAndVerify), apoi îl PORNIM doar pentru partea de login. afterEach îl oprește la loc, ca
  // restul suitei să rămână pe fallback-ul hard-lockout (neatins de teste).
  afterEach(() => { env.TURNSTILE_SECRET = undefined })

  async function loginWith(email: string, password: string, turnstileToken?: string) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: turnstileToken ? { email, password, turnstileToken } : { email, password },
    })
  }

  it('după 3 eșecuri cere captcha; chiar și parola corectă e blocată fără token (anti-DoS), iar token-ul valid deblochează', async () => {
    const { email, password } = await registerAndVerify('captcha@example.com')
    env.TURNSTILE_SECRET = 'test-secret' // pornim Turnstile DOAR pentru login (după ce userul e creat)

    // Sub prag: 3 încercări cu parolă greșită → 401 normal, fără captcha.
    for (let i = 0; i < 3; i++) {
      const res = await loginWith(email, 'WrongPassword1!')
      expect(res.statusCode).toBe(401)
      expect(res.json().error.code).toBe('UNAUTHORIZED')
    }

    // La prag, chiar cu parola CORECTĂ dar fără token → gate captcha (asta oprește account-lockout DoS-ul).
    const gated = await loginWith(email, password)
    expect(gated.statusCode).toBe(401)
    expect(gated.json().error.code).toBe('CAPTCHA_REQUIRED')

    // Token Turnstile valid + parolă corectă → trece.
    const ok = await loginWith(email, password, 'valid-token')
    expect(ok.statusCode).toBe(200)
    expect(ok.json().accessToken).toBeTruthy()
  })

  it('token invalid la prag → tot CAPTCHA_REQUIRED', async () => {
    const { email } = await registerAndVerify('captcha2@example.com')
    env.TURNSTILE_SECRET = 'test-secret' // pornim Turnstile DOAR pentru login (după ce userul e creat)
    for (let i = 0; i < 3; i++) await loginWith(email, 'WrongPassword1!')
    const res = await loginWith(email, 'WrongPassword1!', 'bad-token')
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('CAPTCHA_REQUIRED')
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
// L10 — reuse detection + family revocation. Un refresh token rotat de MULT (peste fereastra
// de grație) și refolosit = semn de furt → se revocă ÎNTREAGA familie (atacator + victimă).
// Distinct de L13 (retry concurent în grație = doar 401, fără revocare).
// ---------------------------------------------------------------------------

describe('POST /auth/refresh — L10 family revocation', () => {
  it('401 + revocă toată familia când un token rotat de >30s e refolosit (furt)', async () => {
    const { email, password } = await registerAndVerify('l10-family@example.com')
    const loginRes = await login(email, password)
    const userId = loginRes.json().user.id as string
    const cookie1 = loginRes.headers['set-cookie'] as string

    // Rotație normală R1 → R2. Acum R1 e marcat rotatedAt=now, R2 e activ (rotatedAt null).
    const refreshRes = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie: cookie1 } })
    expect(refreshRes.statusCode).toBe(200)
    const cookie2 = refreshRes.headers['set-cookie'] as string

    // Îmbătrânim rotația lui R1 dincolo de fereastra de grație (30s), ca reuse-ul să fie tratat ca
    // FURT, nu retry concurent. (Singurul R1 are rotatedAt setat; R2 e exclus de isNotNull.)
    await db.update(refreshTokens)
      .set({ rotatedAt: Date.now() - 31_000 })
      .where(and(eq(refreshTokens.userId, userId), isNotNull(refreshTokens.rotatedAt)))

    // Reuse R1 (token vechi furat) → reuse detectat → revocare de familie.
    const reuse = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie: cookie1 } })
    expect(reuse.statusCode).toBe(401)

    // DOVADA L10: R2 — tokenul LEGITIM al victimei — e ACUM și el invalid (familia revocată).
    const victim = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie: cookie2 } })
    expect(victim.statusCode).toBe(401)
  })

  it('401 FĂRĂ revocare de familie când reuse-ul e în fereastra de grație (retry concurent benign — L13)', async () => {
    const { email, password } = await registerAndVerify('l10-grace@example.com')
    const loginRes = await login(email, password)
    const cookie1 = loginRes.headers['set-cookie'] as string

    const refreshRes = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie: cookie1 } })
    expect(refreshRes.statusCode).toBe(200)
    const cookie2 = refreshRes.headers['set-cookie'] as string

    // Reuse IMEDIAT al lui R1 (în grație) → respins, dar familia NU se revocă.
    const reuse = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie: cookie1 } })
    expect(reuse.statusCode).toBe(401)

    // R2 rămâne valid — victima nu e pedepsită pentru un race benign.
    const stillValid = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie: cookie2 } })
    expect(stillValid.statusCode).toBe(200)
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
