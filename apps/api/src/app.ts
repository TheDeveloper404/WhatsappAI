import Fastify, { type FastifyError } from 'fastify'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { env } from './config/env.js'
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js'
import { AppError } from './utils/errors.js'
import { isEncryptionConfigured } from './utils/crypto.js'

export async function buildApp() {
  // trustProxy = nr. EXACT de proxy-uri de încredere (Caddy / cloudflared = 1), nu `true` —
  // altfel `req.ip` devine controlabil de client prin X-Forwarded-For (bypass rate-limit).
  const app = Fastify({ logger: env.NODE_ENV !== 'test', trustProxy: env.TRUST_PROXY_HOPS, bodyLimit: 1_048_576 })

  if (!isEncryptionConfigured) {
    app.log.warn('WHATSAPP_ENC_KEY nesetat — credențialele WhatsApp se stochează NECRIPTAT în Postgres. Setează `openssl rand -hex 32` în env.')
  }

  // Error handler-ul se setează ÎNAINTE de rute (plugin-urile îl moștenesc la boot).
  app.setErrorHandler((error: FastifyError, _req, reply) => {
    if (error instanceof AppError) {
      const body: Record<string, unknown> = { error: { code: error.code, message: error.message } }
      if (error.details) (body.error as Record<string, unknown>).details = error.details
      return reply.status(error.statusCode).send(body)
    }
    const sc = error.statusCode
    if (typeof sc === 'number' && sc >= 400 && sc < 500) {
      return reply.status(sc).send({ error: { code: error.code ?? 'BAD_REQUEST', message: error.message } })
    }
    // 5xx: mesajul real rămâne doar în log.
    app.log.error(error)
    return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } })
  })

  app.setNotFoundHandler((_req, reply) => {
    return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Resursa cerută nu există.' } })
  })

  // Fastify 5 respinge cu 400 body-ul gol cu `content-type: application/json` (ex. POST-urile fără
  // body din dashboard). Body gol → undefined; restul merge prin parser-ul JSON securizat default.
  const defaultJsonParser = app.getDefaultJsonParser('error', 'error')
  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (body === '') return done(null, undefined)
    defaultJsonParser(req, body as string, done)
  })

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })

  await app.register(rateLimit, { global: true, max: 120, timeWindow: '1 minute' })

  if (env.DASHBOARD_PASSWORD) {
    await app.register(dashboardRoutes)
  } else {
    app.log.warn('DASHBOARD_PASSWORD nesetat — dashboard-ul web e dezactivat. Codul QR apare în loguri.')
  }

  // Health check exceptat de la rate limit (Docker healthcheck / uptime probes).
  app.get('/health', { config: { rateLimit: false } }, async () => ({ status: 'ok' }))

  return app
}
