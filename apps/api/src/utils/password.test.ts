import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password.js'

describe('password', () => {
  it('hashes a password and verifies correctly', async () => {
    const hash = await hashPassword('MyPassword123!')
    expect(hash).not.toBe('MyPassword123!')
    expect(hash.startsWith('$2')).toBe(true)
    await expect(verifyPassword('MyPassword123!', hash)).resolves.toBe(true)
  })

  it('returns false for wrong password', async () => {
    const hash = await hashPassword('correct')
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false)
  })

  it('two hashes of the same password differ (salt)', async () => {
    const h1 = await hashPassword('same')
    const h2 = await hashPassword('same')
    expect(h1).not.toBe(h2)
  })
})
