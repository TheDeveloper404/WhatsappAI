import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'

vi.mock('./utils/email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendAdminNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendCustomEmail: vi.fn().mockResolvedValue(undefined),
  sendAccountDeletionEmail: vi.fn().mockResolvedValue(undefined),
}))

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

// F5 — o origine cross-origin neacceptată trebuie respinsă cu 403, NU cu 500 (eroare zgomotoasă
// care ajută la fingerprinting). Vezi audit pentester F5 + app.ts handler CORS.
describe('CORS (F5)', () => {
  it('403 — origine neacceptată este respinsă curat (nu 500)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example.com' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('200 — fără header Origin (same-origin / curl) trece', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
  })
})

// F3 — 404-urile răspund în ACELAȘI envelope `{error:{code}}` ca restul API-ului (nu forma plată
// default Fastify). setNotFoundHandler în app.ts.
describe('404 (F3)', () => {
  it('404 — rută inexistentă răspunde cu envelope-ul nostru { error: { code: NOT_FOUND } }', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/ruta-care-nu-exista' })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })
})
