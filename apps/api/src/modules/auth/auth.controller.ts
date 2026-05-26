import type { FastifyRequest, FastifyReply } from 'fastify'
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

const REFRESH_COOKIE = 'refreshToken'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
}

function parseBody<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { errors: { path: (string | number)[]; message: string }[] } } }, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw Errors.validation(
      result.error!.errors.map(e => ({ field: String(e.path[0] ?? 'unknown'), message: e.message }))
    )
  }
  return result.data!
}

export const authController = {
  async register(req: FastifyRequest, reply: FastifyReply) {
    const input = parseBody(registerSchema, req.body)
    const user = await authService.register(input)
    return reply.status(201).send({ user })
  },

  async login(req: FastifyRequest, reply: FastifyReply) {
    const input = parseBody(loginSchema, req.body)
    const ip = req.ip
    const { user, accessToken, refreshToken } = await authService.login(input, ip)

    reply.setCookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTS)
    return reply.send({ user, accessToken })
  },

  async logout(req: FastifyRequest, reply: FastifyReply) {
    const refreshToken = req.cookies[REFRESH_COOKIE]
    if (refreshToken) await authService.logout(refreshToken)
    reply.clearCookie(REFRESH_COOKIE, { path: '/' })
    return reply.status(204).send()
  },

  async refresh(req: FastifyRequest, reply: FastifyReply) {
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
