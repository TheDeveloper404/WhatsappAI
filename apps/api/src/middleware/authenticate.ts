import type { FastifyRequest, FastifyReply } from 'fastify'
import { verifyAccessToken } from '../utils/tokens.js'
import { Errors } from '../utils/errors.js'

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) throw Errors.unauthorized('Missing access token.')

  try {
    const payload = verifyAccessToken(header.slice(7))
    req.user = { id: payload.userId, role: payload.role }
  } catch {
    throw Errors.unauthorized('Invalid or expired access token.')
  }
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
