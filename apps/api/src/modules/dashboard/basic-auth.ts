import { createHash, timingSafeEqual } from 'crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { env } from '../../config/env.js'

// Comparație în timp constant pe hash-uri de lungime fixă (evită leak de lungime/timing).
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

// HTTP Basic: orice username, parola = DASHBOARD_PASSWORD. Browserul cere credențialele nativ
// și le retrimite automat pe fetch-urile same-origin ale dashboard-ului.
export async function requireDashboardAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization ?? ''
  if (header.startsWith('Basic ') && env.DASHBOARD_PASSWORD) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
    const password = decoded.slice(decoded.indexOf(':') + 1)
    if (decoded.includes(':') && safeEqual(password, env.DASHBOARD_PASSWORD)) return
  }
  return reply
    .header('WWW-Authenticate', 'Basic realm="WhatsApp AI", charset="UTF-8"')
    .status(401)
    .send({ error: { code: 'UNAUTHORIZED', message: 'Autentificare necesară.' } })
}
