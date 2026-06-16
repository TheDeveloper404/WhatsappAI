import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createHmac } from 'crypto'
import { authenticate } from '../../middleware/authenticate.js'
import { authRepository } from '../auth/auth.repository.js'
import { verifyPassword } from '../../utils/password.js'
import { generateSecureToken } from '../../utils/tokens.js'
import { sendAccountDeletionEmail } from '../../utils/email.js'
import { env } from '../../config/env.js'
import { Errors, AppError } from '../../utils/errors.js'
import { billingRepository } from '../billing/billing.repository.js'
import { stripe } from '../../config/stripe.js'

// Rate-limit dezactivat în test/E2E pentru a evita flakiness (ca în auth.routes).
const rl = (max: number, timeWindow: string) =>
  process.env.NODE_ENV === 'test' || process.env.E2E_MODE === 'true'
    ? {}
    : { config: { rateLimit: { max, timeWindow } } }

export async function userRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: authenticate }, async (req, reply) => {
    const user = await authRepository.findUserById(req.user!.id)
    if (!user) throw Errors.notFound('User')
    return reply.send({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
    })
  })

  // Ștergerea contului e în doi pași (double opt-in pe email) ca să nu poată fi declanșată
  // ireversibil cu un access token furat: chiar știind parola, atacatorul nu poate FINALIZA
  // ștergerea fără acces la emailul victimei. Pasul 1 cere parola și trimite un link cu token.
  app.post('/me/deletion-request', { ...rl(5, '15 minutes'), preHandler: authenticate }, async (req, reply) => {
    const result = z.object({ password: z.string().min(1) }).safeParse(req.body)
    if (!result.success) throw Errors.validation([{ field: 'password', message: 'Parola este obligatorie pentru a șterge contul.' }])

    const user = await authRepository.findUserById(req.user!.id)
    if (!user) throw Errors.notFound('User')

    const passwordOk = await verifyPassword(result.data.password, user.passwordHash)
    if (!passwordOk) throw Errors.unauthorized('Parolă incorectă.')

    // Token brut în email, doar hash-ul în DB (ca la reset parolă). Expiră în 1h.
    const rawToken = generateSecureToken(32)
    const tokenHash = createHmac('sha256', env.JWT_ACCESS_SECRET).update(rawToken).digest('hex')
    await authRepository.updateUser(user.id, {
      deletionToken: tokenHash,
      deletionTokenExpiry: Date.now() + 60 * 60 * 1000,
    })

    // Fire-and-forget: trimiterea emailului nu blochează răspunsul.
    void sendAccountDeletionEmail(user.email, user.name, rawToken).catch(() => {})
    return reply.send({ ok: true })
  })

  // Pasul 2: confirmarea prin link. Fără autentificare — token-ul ESTE dovada (e secret,
  // trimis pe email). Aici ștergerea devine definitivă: închidem sesiunea WhatsApp live,
  // apoi ștergem contul (cascade pe toate datele). Token single-use (dispare cu userul).
  app.post('/me/deletion-confirm', rl(10, '15 minutes'), async (req, reply) => {
    const result = z.object({ token: z.string().min(1) }).safeParse(req.body)
    if (!result.success) throw Errors.validation([{ field: 'token', message: 'Token de confirmare lipsă.' }])

    const tokenHash = createHmac('sha256', env.JWT_ACCESS_SECRET).update(result.data.token).digest('hex')
    const user = await authRepository.findUserByDeletionToken(tokenHash)
    if (!user) throw Errors.unprocessable('Link de ștergere invalid sau expirat.')

    // A3 (S24): anulează abonamentul Stripe ÎNAINTE de orice altceva. Altfel cascade-ul ștergea rândul
    // local, dar abonamentul rămânea ACTIV la Stripe → clientul era taxat în continuare după ce și-a șters
    // contul (money/legal). Dacă anularea eșuează, ABANDONĂM ștergerea (retriabil) ca să nu rămânem
    // niciodată cu „cont șters + abonament activ"; o facem prima, deci nimic altceva nu e atins la eșec.
    const sub = await billingRepository.findByUserId(user.id)
    if (sub?.stripeSubscriptionId && sub.status !== 'canceled') {
      try {
        await stripe.subscriptions.cancel(sub.stripeSubscriptionId)
      } catch (err) {
        app.log.error({ err: String(err), userId: user.id, stripeSubscriptionId: sub.stripeSubscriptionId }, 'A3: Stripe subscription cancel failed — aborting account deletion')
        throw new AppError(503, 'STRIPE_UNAVAILABLE', 'Nu am putut anula abonamentul acum. Reîncearcă în câteva momente.')
      }
    }

    // Închide socket-ul WhatsApp din memorie + curăță starea de auth înainte de ștergere,
    // ca să nu rămână o sesiune orfană activă. Eșecul aici nu blochează ștergerea.
    try {
      const { disconnectSession } = await import('../whatsapp/whatsapp.session-manager.js')
      await disconnectSession(user.id)
    } catch {}

    await authRepository.deleteAccount(user.id)
    return reply.send({ ok: true })
  })
}
