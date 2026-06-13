import { describe, it, expect, vi, beforeEach } from 'vitest'

// Unit test FOCUSAT pe owner bypass (OWNER_EMAIL) în `userHasEntitlement` / `userTier`.
// NU integration: memoizarea owner-ului e state la nivel de modul, iar OWNER_EMAIL vine din env la
// build — așa că mockuim env + repos și resetăm modulul între cazuri ca să avem cache curat.
vi.mock('./billing.repository.js', () => ({
  billingRepository: { findByUserId: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock('../auth/auth.repository.js', () => ({
  authRepository: { findUserByEmail: vi.fn() },
}))
vi.mock('../../config/env.js', () => ({
  env: { OWNER_EMAIL: 'owner@waai.ro' },
}))

const OWNER_ID = 'owner-user-id'
const OTHER_ID = 'other-user-id'

// Re-import proaspăt după `vi.resetModules()` → instanță nouă de entitlement cu cache owner gol.
// Mockurile hoisted (vi.mock) rămân înregistrate pe fișier, deci re-importul tot le primește.
async function load() {
  const ent = await import('./entitlement.js')
  const { authRepository } = await import('../auth/auth.repository.js')
  const { billingRepository } = await import('./billing.repository.js')
  const { env } = await import('../../config/env.js')
  return {
    ent,
    authRepo: vi.mocked(authRepository),
    billingRepo: vi.mocked(billingRepository),
    env: env as { OWNER_EMAIL?: string },
  }
}

// Mock-urile (env, repos) sunt singleton între teste — resetModules curăță DOAR cache-ul owner din
// entitlement (re-import proaspăt), NU istoricul de apeluri al mock-urilor și NU mutațiile pe env.
// Deci: curăț istoricul (clearAllMocks) ȘI restaurez OWNER_EMAIL (un test îl șterge) la fiecare caz.
beforeEach(async () => {
  vi.clearAllMocks()
  vi.resetModules()
  const { env } = await import('../../config/env.js')
  ;(env as { OWNER_EMAIL?: string }).OWNER_EMAIL = 'owner@waai.ro'
})

describe('owner bypass — userHasEntitlement / userTier', () => {
  it('owner FĂRĂ abonament → entitled true + tier max', async () => {
    const { ent, authRepo, billingRepo } = await load()
    authRepo.findUserByEmail.mockResolvedValue({ id: OWNER_ID } as never)
    billingRepo.findByUserId.mockResolvedValue(undefined) // chiar fără rând de abonament

    expect(await ent.userHasEntitlement(OWNER_ID)).toBe(true)
    expect(await ent.userTier(OWNER_ID)).toBe('max')
  })

  it('non-owner FĂRĂ abonament → respins (bypass-ul NU scapă)', async () => {
    const { ent, authRepo, billingRepo } = await load()
    authRepo.findUserByEmail.mockResolvedValue({ id: OWNER_ID } as never)
    billingRepo.findByUserId.mockResolvedValue(undefined)

    expect(await ent.userHasEntitlement(OTHER_ID)).toBe(false)
    expect(await ent.userTier(OTHER_ID)).toBe(null)
  })

  it('OWNER_EMAIL neconfigurat → niciun bypass (cade pe logica normală de abonament)', async () => {
    const { ent, authRepo, billingRepo, env } = await load()
    env.OWNER_EMAIL = undefined
    billingRepo.findByUserId.mockResolvedValue(undefined)

    expect(await ent.userHasEntitlement(OWNER_ID)).toBe(false)
    expect(authRepo.findUserByEmail).not.toHaveBeenCalled() // scurtcircuit înainte de orice query
  })

  it('memoizare: owner rezolvat o singură dată; apeluri repetate NU mai lovesc DB', async () => {
    const { ent, authRepo } = await load()
    authRepo.findUserByEmail.mockResolvedValue({ id: OWNER_ID } as never)

    await ent.userHasEntitlement(OWNER_ID) // 1× lookup → cache = OWNER_ID
    await ent.userHasEntitlement(OWNER_ID) // fast-path pe cache, fără lookup
    await ent.userTier(OWNER_ID)           // idem

    expect(authRepo.findUserByEmail).toHaveBeenCalledTimes(1)
  })

  it('steady-state: după ce owner-ul e rezolvat, apelurile non-owner nu mai re-rezolvă owner-ul', async () => {
    const { ent, authRepo, billingRepo } = await load()
    authRepo.findUserByEmail.mockResolvedValue({ id: OWNER_ID } as never)
    billingRepo.findByUserId.mockResolvedValue(undefined)

    await ent.userHasEntitlement(OWNER_ID) // rezolvă cache = OWNER_ID (1× lookup)
    await ent.userHasEntitlement(OTHER_ID) // cache != null și != userId → false, fără lookup nou

    expect(authRepo.findUserByEmail).toHaveBeenCalledTimes(1)
  })
})
