import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { env } from '../config/env.js'

// Parses "15m" → ms, "7d" → ms
function parseDuration(str: string): number {
  const units: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
  const match = str.match(/^(\d+)([smhd])$/)
  if (!match) throw new Error(`Invalid duration: ${str}`)
  return parseInt(match[1]) * units[match[2]]
}

export interface TokenPayload {
  userId: string
  role: string
  iat: number
  exp: number
}

function base64url(data: string): string {
  return Buffer.from(data).toString('base64url')
}

function sign(payload: object, secret: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

function verify(token: string, secret: string): TokenPayload {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token structure')
  const [header, body, sig] = parts
  // Comparație constant-time a semnăturii — evită timing side-channel pe HMAC.
  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest()
  let provided: Buffer
  try { provided = Buffer.from(sig, 'base64url') } catch { throw new Error('Invalid token signature') }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error('Invalid token signature')
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload
  if (Date.now() > payload.exp * 1000) throw new Error('Token expired')
  return payload
}

export function createAccessToken(userId: string, role: string): string {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + Math.floor(parseDuration(env.JWT_ACCESS_EXPIRES_IN) / 1000)
  const jti = randomBytes(8).toString('hex')
  return sign({ userId, role, iat: now, exp, jti }, env.JWT_ACCESS_SECRET)
}

export function createRefreshToken(userId: string, role: string): string {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + Math.floor(parseDuration(env.JWT_REFRESH_EXPIRES_IN) / 1000)
  const jti = randomBytes(8).toString('hex')
  return sign({ userId, role, iat: now, exp, jti }, env.JWT_REFRESH_SECRET)
}

export function verifyAccessToken(token: string): TokenPayload {
  return verify(token, env.JWT_ACCESS_SECRET)
}

export function verifyRefreshToken(token: string): TokenPayload {
  return verify(token, env.JWT_REFRESH_SECRET)
}

// Sesiune admin: token semnat, scurt, emis după validarea ADMIN_SECRET.
// Cheie derivată DISTINCT din JWT_ACCESS_SECRET — un token de user nu poate trece
// drept admin și invers, fără a introduce o variabilă de mediu nouă.
const ADMIN_SESSION_SECRET = createHmac('sha256', env.JWT_ACCESS_SECRET).update('admin-session-v1').digest('hex')

export function createAdminSession(): string {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 2 * 60 * 60 // 2h
  const jti = randomBytes(8).toString('hex')
  return sign({ scope: 'admin', iat: now, exp, jti }, ADMIN_SESSION_SECRET)
}

export function verifyAdminSession(token: string): void {
  const payload = verify(token, ADMIN_SESSION_SECRET) as TokenPayload & { scope?: string }
  if (payload.scope !== 'admin') throw new Error('Not an admin session token')
}

export function hashToken(token: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex')
}

export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

export function refreshTokenExpiresAt(): Date {
  return new Date(Date.now() + parseDuration(env.JWT_REFRESH_EXPIRES_IN))
}
