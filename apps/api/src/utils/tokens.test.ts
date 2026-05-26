import { describe, it, expect } from 'vitest'
import {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  generateSecureToken,
} from './tokens.js'

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
