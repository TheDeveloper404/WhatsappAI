import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'

vi.mock('../../utils/email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendAdminNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendCustomEmail: vi.fn().mockResolvedValue(undefined),
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

describe('DELETE /users/me', () => {
  it('401 — no token rejected', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/users/me',
      payload: { password: 'Password123!' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('400 — missing password rejected', async () => {
    const { accessToken } = await registerAndLogin('del-nopass@example.com')
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('401 — wrong password rejected', async () => {
    const { accessToken } = await registerAndLogin('del-wrongpass@example.com')
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { password: 'GreșităTotal1!' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('200 — correct password schedules deletion', async () => {
    const { accessToken } = await registerAndLogin('del-ok@example.com')
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { password: 'Password123!' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })

  it('400 — already scheduled rejected', async () => {
    const { accessToken } = await registerAndLogin('del-twice@example.com')
    await app.inject({
      method: 'DELETE',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { password: 'Password123!' },
    })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { password: 'Password123!' },
    })
    expect(res.statusCode).toBe(400)
  })
})
