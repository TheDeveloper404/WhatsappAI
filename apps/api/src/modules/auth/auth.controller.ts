import type { FastifyRequest, FastifyReply } from 'fastify'
import type { ZodType } from 'zod'
import { authService } from './auth.service.js'
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.schemas.js'
import { Errors } from '../../utils/errors.js'
import { env } from '../../config/env.js'
import { verifyTurnstile } from '../../utils/turnstile.js'

const REFRESH_COOKIE = 'refreshToken'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
}

// CSRF defense (L1) pentru endpoint-urile cu efect pe cookie (refresh/logout). Cookie-ul e
// SameSite=none, deci o pagină cross-site l-ar putea trimite. Cererile legitime vin fie server-to-server
// prin proxy-ul Next (FĂRĂ header Origin), fie de pe originile permise. Respingem dacă Origin e prezent
// și NU e în allowlist.
function assertTrustedOrigin(req: FastifyRequest): void {
  const origin = req.headers.origin
  if (!origin) return
  const allowed = new Set([
    env.APP_URL.replace(/\/$/, ''),
    ...(env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, '')) : []),
  ])
  if (!allowed.has(origin.replace(/\/$/, ''))) throw Errors.forbidden('Cross-site request blocked.')
}

function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw Errors.validation(
      result.error.issues.map(e => ({ field: String(e.path[0] ?? 'unknown'), message: e.message }))
    )
  }
  return result.data
}

export const authController = {
  async register(req: FastifyRequest, reply: FastifyReply) {
    // Captcha invizibil (Turnstile): aplicat DOAR când secretul e configurat (prod). În dev/test/E2E
    // unde nu e setat, sărim — ca testele de register să nu necesite token. Verificat înainte de a
    // atinge baza de date / a trimite emailuri (oprește boții cât mai devreme).
    if (env.TURNSTILE_SECRET) {
      const token = (req.body as { turnstileToken?: string } | undefined)?.turnstileToken
      const ok = await verifyTurnstile(env.TURNSTILE_SECRET, token, req.ip)
      if (!ok) {
        throw Errors.validation([{ field: 'turnstileToken', message: 'Verificarea anti-bot a eșuat. Reîncarcă pagina și reîncearcă.' }])
      }
    }
    const input = parseBody(registerSchema, req.body)
    await authService.register(input)
    // Răspuns generic IDENTIC indiferent dacă emailul are deja cont (anti-enumerare M8).
    return reply.status(201).send({ message: 'Verifică-ți emailul pentru a confirma contul.' })
  },

  async login(req: FastifyRequest, reply: FastifyReply) {
    const input = parseBody(loginSchema, req.body)
    const ip = req.ip
    const { user, accessToken, refreshToken } = await authService.login(input, ip)

    reply.setCookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTS)
    return reply.send({ user, accessToken })
  },

  async logout(req: FastifyRequest, reply: FastifyReply) {
    assertTrustedOrigin(req)
    const refreshToken = req.cookies[REFRESH_COOKIE]
    if (refreshToken) await authService.logout(refreshToken)
    reply.clearCookie(REFRESH_COOKIE, { path: '/', secure: true, sameSite: 'none' })
    return reply.status(204).send()
  },

  async refresh(req: FastifyRequest, reply: FastifyReply) {
    assertTrustedOrigin(req)
    const refreshToken = req.cookies[REFRESH_COOKIE]
    if (!refreshToken) throw Errors.unauthorized('No refresh token provided.')

    const { accessToken, refreshToken: newRefresh } = await authService.refresh(refreshToken)
    reply.setCookie(REFRESH_COOKIE, newRefresh, COOKIE_OPTS)
    return reply.send({ accessToken })
  },

  async verifyEmail(req: FastifyRequest, reply: FastifyReply) {
    const { token } = parseBody(verifyEmailSchema, req.body)
    await authService.verifyEmail(token)
    return reply.send({ message: 'Email verified successfully.' })
  },

  async forgotPassword(req: FastifyRequest, reply: FastifyReply) {
    const { email } = parseBody(forgotPasswordSchema, req.body)
    await authService.forgotPassword(email)
    return reply.send({ message: 'If an account exists with this email, a reset link has been sent.' })
  },

  async resetPassword(req: FastifyRequest, reply: FastifyReply) {
    const { token, password } = parseBody(resetPasswordSchema, req.body)
    await authService.resetPassword(token, password)
    return reply.send({ message: 'Password has been reset successfully.' })
  },
}
