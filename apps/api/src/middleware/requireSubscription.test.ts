import { describe, it, expect, vi, beforeEach } from 'vitest'

// F-OWN-01: owner-bypass-ul pe rute trebuie să facă match case-insensitive între `req.user.email`
// și `OWNER_EMAIL` (emailurile userilor sunt lowercased la register; un email legacy mixed-case sau un
// OWNER_EMAIL ne-normalizat NU trebuie să rateze silent bypass-ul). Mockuim env + entitlement.
vi.mock('../config/env.js', () => ({ env: { OWNER_EMAIL: 'owner@waai.ro' } }))
vi.mock('../modules/billing/entitlement.js', () => ({ userHasEntitlement: vi.fn() }))

async function load() {
  const { requireActiveSubscription } = await import('./requireSubscription.js')
  const { userHasEntitlement } = await import('../modules/billing/entitlement.js')
  return { requireActiveSubscription, userHasEntitlement: vi.mocked(userHasEntitlement) }
}

const reply = {} as never

beforeEach(() => vi.clearAllMocks())

describe('requireActiveSubscription — owner bypass case-insensitive (F-OWN-01)', () => {
  it('email owner cu MAJUSCULE → bypass (nu aruncă, nu mai verifică abonamentul)', async () => {
    const { requireActiveSubscription, userHasEntitlement } = await load()
    const req = { user: { id: 'u', role: 'user', email: 'Owner@Waai.ro' } } as never

    await expect(requireActiveSubscription(req, reply)).resolves.toBeUndefined()
    expect(userHasEntitlement).not.toHaveBeenCalled() // bypass-ul a scurtcircuitat înainte de query
  })

  it('non-owner → cade pe verificarea de abonament (fără bypass)', async () => {
    const { requireActiveSubscription, userHasEntitlement } = await load()
    userHasEntitlement.mockResolvedValue(true)
    const req = { user: { id: 'u2', role: 'user', email: 'client@exemplu.ro' } } as never

    await expect(requireActiveSubscription(req, reply)).resolves.toBeUndefined()
    expect(userHasEntitlement).toHaveBeenCalledWith('u2') // s-a verificat entitlement-ul real
  })
})
