import { v4 as uuidv4 } from 'uuid'
import { createHmac } from 'crypto'
import { logger } from '../../utils/logger.js'
import { authRepository } from './auth.repository.js'
import { hashPassword, verifyPassword, verifyPasswordDummy } from '../../utils/password.js'
import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateSecureToken,
  refreshTokenExpiresAt,
} from '../../utils/tokens.js'
import { sendVerificationEmail, sendPasswordResetEmail, sendAlreadyRegisteredEmail } from '../../utils/email.js'
import { notifyAdmin } from '../admin/notifications.service.js'
import { Errors } from '../../utils/errors.js'
import { env } from '../../config/env.js'
import type { RegisterInput, LoginInput } from './auth.schemas.js'

const MAX_LOGIN_ATTEMPTS = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000
// Fereastra în care reutilizarea unui token deja rotat e tratată ca retry concurent benign (L13),
// nu ca furt. Peste ea, un token rotat reprezentat = reuse suspect → revocare de familie (L10).
const REFRESH_REUSE_GRACE_MS = 30 * 1000

export const authService = {
  // Anti-enumerare (M8): răspunsul HTTP e IDENTIC indiferent dacă emailul are deja cont (controller-ul
  // întoarce mereu 201 + mesaj generic). Aici aliniem și munca/timpul: pe ramura „email există" rulăm
  // un bcrypt dummy (cât hashPassword) și trimitem un email „ai deja cont"; pe ambele ramuri emailul e
  // fire-and-forget, deci durata lui nu trădează existența contului.
  async register(input: RegisterInput) {
    const existing = await authRepository.findUserByEmail(input.email)
    if (existing) {
      await verifyPasswordDummy(input.password)
      void sendAlreadyRegisteredEmail(existing.email, existing.name).catch(err =>
        logger.error('[auth] already-registered email failed', { err: err.message })
      )
      return
    }

    const passwordHash = await hashPassword(input.password)
    const verifyToken = generateSecureToken(32)
    const verifyTokenHash = createHmac('sha256', env.JWT_ACCESS_SECRET).update(verifyToken).digest('hex')
    const now = Date.now()

    let user
    try {
      user = await authRepository.createUser({
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
    } catch (err: any) {
      // Race (L14): alt request a creat între timp același email → violare de unicitate (PG 23505).
      // Tratăm ca „deja există": răspuns generic identic (anti-enumerare), nu 500.
      if (err?.code === '23505') {
        void sendAlreadyRegisteredEmail(input.email, input.name).catch(() => {})
        return
      }
      throw err
    }

    void sendVerificationEmail(user.email, user.name, verifyToken).catch(err =>
      logger.error('[auth] verification email failed', { err: err.message })
    )
    notifyAdmin('new_user', 'User nou înregistrat', `Nume: ${user.name}\nEmail: ${user.email}`).catch(() => {})
  },

  async login(input: LoginInput, ip: string) {
    const since = new Date(Date.now() - LOGIN_WINDOW_MS)
    const attempts = await authRepository.countRecentLoginAttempts(input.email, since)
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      throw Errors.unauthorized('Prea multe încercări eșuate. Încearcă din nou peste 15 minute.')
    }

    const user = await authRepository.findUserByEmail(input.email)
    if (!user) {
      // Timp constant (M6): rulăm un bcrypt „dummy" de aceeași durată ca o verificare reală, ca
      // diferența de timing să nu trădeze că emailul nu are cont.
      await verifyPasswordDummy(input.password)
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

    if (user.deletionScheduledAt) {
      throw Errors.forbidden('Acest cont este programat pentru ștergere și nu mai poate fi accesat.')
    }

    const accessToken = createAccessToken(user.id, user.role)
    const refreshToken = createRefreshToken(user.id, user.role)
    const tokenHash = hashToken(refreshToken)

    // Fiecare autentificare pornește o familie nouă de refresh tokens (L10). Rotațiile ulterioare
    // moștenesc același familyId, ca un reuse detectat să poată revoca tot lanțul.
    await authRepository.saveRefreshToken(uuidv4(), user.id, tokenHash, refreshTokenExpiresAt(), uuidv4())

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
    // Claim atomic (L13): din două cereri concurente cu același token, doar una îl revendică și
    // continuă; cealaltă primește undefined (fără două sesiuni valide din același token).
    const claimed = await authRepository.claimRefreshToken(tokenHash)
    if (!claimed) {
      // Nu am putut revendica. Inspectăm de ce: dacă tokenul EXISTĂ dar e deja rotat, e fie un
      // retry concurent benign (rotat acum o clipă — L13), fie un REUSE al unui token vechi furat.
      const existing = await authRepository.findRefreshTokenAny(tokenHash)
      if (existing?.rotatedAt && Date.now() - existing.rotatedAt > REFRESH_REUSE_GRACE_MS) {
        // Reuse al unui token deja rotat de mult → semn de furt → revocăm ÎNTREAGA familie (L10).
        // Atacatorul ȘI victima sunt delogați; forțează re-login, atacatorul pierde accesul.
        await authRepository.revokeFamily(existing.familyId ?? existing.id)
        logger.warn('[auth] refresh token reuse detected — family revoked', { userId: existing.userId })
      }
      // Retry concurent în fereastra de grație: respingem doar această cerere, fără a revoca familia.
      throw Errors.unauthorized('Refresh token revoked or expired.')
    }

    const user = await authRepository.findUserById(payload.userId)
    if (!user) throw Errors.unauthorized()

    const newAccessToken = createAccessToken(user.id, user.role)
    const newRefreshToken = createRefreshToken(user.id, user.role)
    const newHash = hashToken(newRefreshToken)

    // Tokenul nou moștenește familyId-ul lanțului (fallback la id-ul propriu pentru sesiuni legacy
    // create înainte de migrare, unde familyId putea fi null deși backfill-ul îl setează).
    await authRepository.saveRefreshToken(uuidv4(), user.id, newHash, refreshTokenExpiresAt(), claimed.familyId ?? uuidv4())

    return { accessToken: newAccessToken, refreshToken: newRefreshToken }
  },

  async logout(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken)
    // Revocăm întreaga familie, nu doar tokenul prezentat — logout-ul închide tot lanțul de rotații
    // al acelei sesiuni (L10). Dacă nu găsim rândul (token deja șters/expirat), e no-op.
    const existing = await authRepository.findRefreshTokenAny(tokenHash)
    if (existing) await authRepository.revokeFamily(existing.familyId ?? existing.id)
    else await authRepository.deleteRefreshToken(tokenHash)
  },

  async verifyEmail(token: string) {
    const tokenHash = createHmac('sha256', env.JWT_ACCESS_SECRET).update(token).digest('hex')
    const user = await authRepository.findUserByVerifyToken(tokenHash)
    if (!user) throw Errors.unprocessable('Link de verificare invalid sau expirat.')
    // L18: cont programat la ștergere — nu reactivăm prin verificare în fereastra de 48h.
    if (user.deletionScheduledAt) throw Errors.unprocessable('Acest cont este programat pentru ștergere.')

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

    // Fire-and-forget (M6): nu așteptăm trimiterea emailului în calea răspunsului, ca durata lui
    // (componenta de timing dominantă) să nu trădeze că emailul are cont. Răspunsul e oricum generic.
    void sendPasswordResetEmail(user.email, rawToken).catch(err =>
      logger.error('[auth] forgotPassword email failed', { err: err.message })
    )
  },

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = createHmac('sha256', env.JWT_ACCESS_SECRET).update(rawToken).digest('hex')
    const user = await authRepository.findUserByResetToken(tokenHash)
    if (!user) throw Errors.unprocessable('This reset link is invalid or has expired.')
    // L18: cont programat la ștergere — nu permitem resetarea parolei în fereastra de 48h.
    if (user.deletionScheduledAt) throw Errors.unprocessable('Acest cont este programat pentru ștergere.')

    const passwordHash = await hashPassword(newPassword)
    await authRepository.updateUser(user.id, {
      passwordHash,
      resetPasswordToken: undefined,
      resetPasswordTokenExpiry: undefined,
    })
    await authRepository.deleteAllRefreshTokensForUser(user.id)
  },
}
