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

import { sendVerificationEmail } from '../../utils/email.js'
import { aiRepository, aiUsagePeriod } from './ai.repository.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

async function registerUser(email: string): Promise<string> {
  vi.mocked(sendVerificationEmail).mockClear()
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { name: 'Usage User', email, password: 'Password123!' },
  })
  const [, , token] = vi.mocked(sendVerificationEmail).mock.calls[0] as [string, string, string]
  await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token } })
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'Password123!' },
  })
  return res.json().user.id as string
}

// ---------------------------------------------------------------------------
// aiUsagePeriod — funcție PURĂ. Cheia de lună 'YYYY-MM' în ora RO.
// ---------------------------------------------------------------------------

describe('aiUsagePeriod (pur) — cheia de lună', () => {
  it("format 'YYYY-MM'", () => {
    // 15 iunie 2026, 12:00 UTC → în RO tot iunie.
    const ts = Date.UTC(2026, 5, 15, 12, 0, 0)
    expect(aiUsagePeriod(ts)).toBe('2026-06')
  })

  it('rezultă o lună diferită pentru luni diferite', () => {
    expect(aiUsagePeriod(Date.UTC(2026, 0, 10, 12))).toBe('2026-01')
    expect(aiUsagePeriod(Date.UTC(2026, 11, 10, 12))).toBe('2026-12')
  })
})

// ---------------------------------------------------------------------------
// Contor durabil ai_usage — get + increment atomic.
// ---------------------------------------------------------------------------

describe('contor consum AI lunar (ai_usage)', () => {
  it('lună nouă → 0', async () => {
    const userId = await registerUser('usage-zero@test.com')
    expect(await aiRepository.getMonthlyAiUsage(userId, '2026-06')).toBe(0)
  })

  it('increment → întoarce noul total și e citit de get', async () => {
    const userId = await registerUser('usage-incr@test.com')
    expect(await aiRepository.incrementMonthlyAiUsage(userId, '2026-06')).toBe(1)
    expect(await aiRepository.incrementMonthlyAiUsage(userId, '2026-06')).toBe(2)
    expect(await aiRepository.getMonthlyAiUsage(userId, '2026-06')).toBe(2)
  })

  it('luni diferite — contoare separate', async () => {
    const userId = await registerUser('usage-months@test.com')
    await aiRepository.incrementMonthlyAiUsage(userId, '2026-06')
    await aiRepository.incrementMonthlyAiUsage(userId, '2026-07')
    await aiRepository.incrementMonthlyAiUsage(userId, '2026-07')
    expect(await aiRepository.getMonthlyAiUsage(userId, '2026-06')).toBe(1)
    expect(await aiRepository.getMonthlyAiUsage(userId, '2026-07')).toBe(2)
  })

  it('useri diferiți — contoare izolate', async () => {
    const a = await registerUser('usage-iso-a@test.com')
    const b = await registerUser('usage-iso-b@test.com')
    await aiRepository.incrementMonthlyAiUsage(a, '2026-06')
    expect(await aiRepository.getMonthlyAiUsage(a, '2026-06')).toBe(1)
    expect(await aiRepository.getMonthlyAiUsage(b, '2026-06')).toBe(0)
  })
})
