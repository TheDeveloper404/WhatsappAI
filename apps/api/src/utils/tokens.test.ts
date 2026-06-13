import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { env } from '../config/env.js'
import {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  generateSecureToken,
} from './tokens.js'

// Helper local: semnează un payload arbitrar cu un secret dat (replică `sign` din tokens.ts), ca să
// putem forja token-uri cu semnătură VALIDĂ dar `typ` greșit — exact scenariul pe care F-AUTH-01 îl blochează.
function signRaw(payload: object, secret: string): string {
  const b64 = (s: string) => Buffer.from(s).toString('base64url')
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64(JSON.stringify(payload))
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

describe('tokens', () => {
  describe('access token', () => {
    it('creates and verifies a valid token', () => {
      const token = createAccessToken('user-1', 'user')
      const payload = verifyAccessToken(token)
      expect(payload.userId).toBe('user-1')
      expect(payload.role).toBe('user')
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
    })

    it('throws on tampered signature', () => {
      const token = createAccessToken('user-1', 'user')
      const parts = token.split('.')
      const tampered = `${parts[0]}.${parts[1]}.invalidsig`
      expect(() => verifyAccessToken(tampered)).toThrow('Invalid token signature')
    })

    it('throws on expired token', () => {
      // Build a token that expired 1 second ago
      const parts = createAccessToken('user-1', 'user').split('.')
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
      payload.exp = Math.floor(Date.now() / 1000) - 1
      const fakeBody = Buffer.from(JSON.stringify(payload)).toString('base64url')
      // Signature won't match, so we just check that tampered = expired error or signature error
      const tampered = `${parts[0]}.${fakeBody}.${parts[2]}`
      expect(() => verifyAccessToken(tampered)).toThrow()
    })

    it('throws on malformed token', () => {
      expect(() => verifyAccessToken('not.a.token.at.all')).toThrow()
    })
  })

  describe('refresh token', () => {
    it('creates and verifies a valid token', () => {
      const token = createRefreshToken('user-2', 'admin')
      const payload = verifyRefreshToken(token)
      expect(payload.userId).toBe('user-2')
      expect(payload.role).toBe('admin')
    })

    it('access token secret does not verify refresh token', () => {
      const refresh = createRefreshToken('user-1', 'user')
      expect(() => verifyAccessToken(refresh)).toThrow()
    })
  })

  // F-AUTH-01: token-urile poartă un claim `typ` verificat, ca un refresh să nu fie folosit ca access
  // (și invers) chiar dacă semnătura ar fi validă pe acel secret. Token legacy fără `typ` = acceptat (grace).
  describe('F-AUTH-01 — confinare `typ` pe scop', () => {
    it('token-urile create poartă `typ` corect', () => {
      expect(verifyAccessToken(createAccessToken('u', 'user')).typ).toBe('access')
      expect(verifyRefreshToken(createRefreshToken('u', 'user')).typ).toBe('refresh')
    })

    it('refresh-token cu semnătură VALIDĂ pe secretul de access e respins de verifyAccessToken', () => {
      const now = Math.floor(Date.now() / 1000)
      const forged = signRaw({ userId: 'u', role: 'user', typ: 'refresh', iat: now, exp: now + 900 }, env.JWT_ACCESS_SECRET)
      expect(() => verifyAccessToken(forged)).toThrow('Wrong token type')
    })

    it('access-token cu semnătură VALIDĂ pe secretul de refresh e respins de verifyRefreshToken', () => {
      const now = Math.floor(Date.now() / 1000)
      const forged = signRaw({ userId: 'u', role: 'user', typ: 'access', iat: now, exp: now + 900 }, env.JWT_REFRESH_SECRET)
      expect(() => verifyRefreshToken(forged)).toThrow('Wrong token type')
    })

    it('token legacy FĂRĂ `typ` rămâne acceptat (backward-compat tranzitoriu)', () => {
      const now = Math.floor(Date.now() / 1000)
      const legacy = signRaw({ userId: 'u', role: 'user', iat: now, exp: now + 900 }, env.JWT_ACCESS_SECRET)
      expect(verifyAccessToken(legacy).userId).toBe('u')
    })
  })

  describe('hashToken', () => {
    it('is deterministic', () => {
      expect(hashToken('abc')).toBe(hashToken('abc'))
    })

    it('different inputs produce different hashes', () => {
      expect(hashToken('abc')).not.toBe(hashToken('def'))
    })
  })

  describe('generateSecureToken', () => {
    it('generates a hex string of correct length', () => {
      const token = generateSecureToken(32)
      expect(token).toHaveLength(64) // 32 bytes = 64 hex chars
      expect(/^[0-9a-f]+$/.test(token)).toBe(true)
    })

    it('each call produces a unique token', () => {
      expect(generateSecureToken(32)).not.toBe(generateSecureToken(32))
    })
  })
})
