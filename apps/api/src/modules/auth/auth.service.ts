import { v4 as uuidv4 } from 'uuid'
import { createHmac } from 'crypto'
import { authRepository } from './auth.repository.js'
import { hashPassword, verifyPassword } from '../../utils/password.js'
import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateSecureToken,
  refreshTokenExpiresAt,
} from '../../utils/tokens.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../../utils/email.js'
import { notifyAdmin } from '../admin/notifications.service.js'
import { Errors } from '../../utils/errors.js'
import { env } from '../../config/env.js'
import type { RegisterInput, LoginInput } from './auth.schemas.js'

const MAX_LOGIN_ATTEMPTS = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000

export const authService = {
  async register(input: RegisterInput) {
    const existing = await authRepository.findUserByEmail(input.email)
    if (existing) {
      throw Errors.conflict('Registration failed. Please try again or log in.')
    }

    const passwordHash = await hashPassword(input.password)
    const verifyToken = generateSecureToken(32)
    const verifyTokenHash = createHmac('sha256', env.JWT_ACCESS_SECRET).update(verifyToken).digest('hex')
    const now = Date.now()

    const user = await authRepository.createUser({
      id: uuidv4(),
      name: input.name,
      email: input.email,
      passwordHash,
      emailVerified: false,
      emailVerifyToken: verifyTokenHash,
      emailVerifyTokenExpiry: now + 24 * 60 * 60 * 1000,
      role: 'user',
      createdAt: now,
      updatedAt: now,
    })

    await sendVerificationEmail(user.email, user.name, verifyToken).catch(err =>
      console.error('[register] verification email failed:', err.message)
    )
    notifyAdmin('new_user', 'User nou înregistrat', `Nume: ${user.name}\nEmail: ${user.email}`).catch(() => {})

    return { id: user.id, name: user.name, email: user.email, createdAt: new Date(user.createdAt) }
  },

  async login(input: LoginInput, ip: string) {
    const since = new Date(Date.now() - LOGIN_WINDOW_MS)
    const attempts = await authRepository.countRecentLoginAttempts(input.email, since)
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      throw Errors.unauthorized('Prea multe încercări eșuate. Încearcă din nou peste 15 minute.')
    }

    const user = await authRepository.findUserByEmail(input.email)
    if (!user) {
      await authRepository.logLoginAttempt(uuidv4(), input.email, ip)
      throw Errors.unauthorized('Email sau parolă incorectă.')
    }

    const valid = await verifyPassword(input.password, user.passwordHash)
    if (!valid) {
      await authRepository.logLoginAttempt(uuidv4(), input.email, ip)
      throw Errors.unauthorized('Email sau parolă incorectă.')
    }

    if (!user.emailVerified) {
      throw Errors.forbidden('Trebuie să îți verifici emailul înainte de a te loga. Verifică inbox-ul.')
    }

    const accessToken = createAccessToken(user.id, user.role)
    const refreshToken = createRefreshToken(user.id, user.role)
    const tokenHash = hashToken(refreshToken)

    await authRepository.saveRefreshToken(uuidv4(), user.id, tokenHash, refreshTokenExpiresAt())

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    }
  },

  async refresh(rawRefreshToken: string) {
    let payload
    try {
      payload = verifyRefreshToken(rawRefreshToken)
    } catch {
      throw Errors.unauthorized('Invalid or expired refresh token.')
    }

    const tokenHash = hashToken(rawRefreshToken)
    const stored = await authRepository.findRefreshToken(tokenHash)
    if (!stored) throw Errors.unauthorized('Refresh token revoked or expired.')

    await authRepository.deleteRefreshToken(tokenHash)

    const user = await authRepository.findUserById(payload.userId)
    if (!user) throw Errors.unauthorized()

    const newAccessToken = createAccessToken(user.id, user.role)
    const newRefreshToken = createRefreshToken(user.id, user.role)
    const newHash = hashToken(newRefreshToken)

    await authRepository.saveRefreshToken(uuidv4(), user.id, newHash, refreshTokenExpiresAt())

    return { accessToken: newAccessToken, refreshToken: newRefreshToken }
  },

  async logout(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken)
    await authRepository.deleteRefreshToken(tokenHash)
  },

  async verifyEmail(token: string) {
    const tokenHash = createHmac('sha256', env.JWT_ACCESS_SECRET).update(token).digest('hex')
    const user = await authRepository.findUserByVerifyToken(tokenHash)
    if (!user) throw Errors.unprocessable('Link de verificare invalid sau expirat.')

    await authRepository.updateUser(user.id, {
      emailVerified: true,
      emailVerifyToken: undefined,
      emailVerifyTokenExpiry: undefined,
    })
  },

  async forgotPassword(email: string) {
    const user = await authRepository.findUserByEmail(email)
    if (!user) return

    const rawToken = generateSecureToken(32)
    const tokenHash = createHmac('sha256', env.JWT_ACCESS_SECRET).update(rawToken).digest('hex')

    await authRepository.updateUser(user.id, {
      resetPasswordToken: tokenHash,
      resetPasswordTokenExpiry: Date.now() + 60 * 60 * 1000,
    })

    await sendPasswordResetEmail(user.email, rawToken).catch(err =>
      console.error('[forgotPassword] email send failed:', err.message)
    )
  },

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = createHmac('sha256', env.JWT_ACCESS_SECRET).update(rawToken).digest('hex')
    const user = await authRepository.findUserByResetToken(tokenHash)
    if (!user) throw Errors.unprocessable('This reset link is invalid or has expired.')

    const passwordHash = await hashPassword(newPassword)
    await authRepository.updateUser(user.id, {
      passwordHash,
      resetPasswordToken: undefined,
      resetPasswordTokenExpiry: undefined,
    })
    await authRepository.deleteAllRefreshTokensForUser(user.id)
  },
}
