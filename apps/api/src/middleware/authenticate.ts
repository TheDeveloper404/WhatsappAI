import type { FastifyRequest, FastifyReply } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../config/database.js'
import { users } from '../db/schema.js'
import { verifyAccessToken } from '../utils/tokens.js'
import { Errors } from '../utils/errors.js'

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) throw Errors.unauthorized('Missing access token.')

  let payload
  try {
    payload = verifyAccessToken(header.slice(7))
  } catch {
    throw Errors.unauthorized('Invalid or expired access token.')
  }

  // H4: JWT e stateless, dar verificăm per-request statusul contului ca să INVALIDĂM IMEDIAT
  // token-urile unui cont șters sau programat pentru ștergere (altfel ar rămâne valide până la exp,
  // ~15 min). O singură citire indexată după PK. Dimensiunea „abonament" e acoperită separat de
  // `requireActiveSubscription` (C1/C2) pe rutele premium.
  const rows = await db
    .select({ deletionScheduledAt: users.deletionScheduledAt })
    .from(users)
    .where(eq(users.id, payload.userId))
  if (rows.length === 0 || rows[0].deletionScheduledAt != null) {
    throw Errors.unauthorized('Account no longer active.')
  }

  req.user = { id: payload.userId, role: payload.role }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await authenticate(req, reply)
  if (req.user?.role !== 'admin') throw Errors.forbidden()
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; role: string }
  }
}
