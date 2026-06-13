import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { requireActiveSubscription } from '../../middleware/requireSubscription.js'
import { billingService } from './billing.service.js'
import { userHasEntitlement, userTier } from './entitlement.js'
import { Errors } from '../../utils/errors.js'
import { z } from 'zod'

// `tier` default 'pro': frontend-ul vechi (trimite doar `plan`) rămâne funcțional → Pro,
// până la actualizarea UI-ului (Felia 3). Frontend-ul nou trimite tier-ul explicit.
const checkoutSchema = z.object({
  plan: z.enum(['monthly', 'annual']),
  tier: z.enum(['pro', 'max']).default('pro'),
})

export async function billingRoutes(app: FastifyInstance) {
  app.post('/checkout', { preHandler: authenticate }, async (req, reply) => {
    const result = checkoutSchema.safeParse(req.body)
    if (!result.success) throw Errors.validation(result.error.issues.map(e => ({ field: String(e.path[0]), message: e.message })))

    const { url } = await billingService.createCheckoutSession(req.user!.id, result.data.plan, result.data.tier)
    return reply.send({ url })
  })

  app.post('/portal', { preHandler: authenticate }, async (req, reply) => {
    const { url } = await billingService.createPortalSession(req.user!.id)
    return reply.send({ url })
  })

  // Upgrade in-place Pro → Max pe abonamentul existent (proration pe factura următoare). `requireActiveSubscription`
  // = trebuie să fie deja abonat (entitled) ca să facă upgrade; serviciul mai validează tier-ul curent.
  app.post('/upgrade', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } }, preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const result = await billingService.upgradeToMax(req.user!.id)
    return reply.send(result)
  })

  app.get('/subscription', { preHandler: authenticate }, async (req, reply) => {
    const sub = await billingService.getSubscription(req.user!.id)
    // `entitled` = owner-aware (bypass OWNER_EMAIL inclus prin userHasEntitlement), aceeași sursă de
    // adevăr ca gate-ul de 402. UI-ul gateuiește pe ASTA, nu pe statusul brut al abonamentului — altfel
    // owner-ul (fără rând de abonament) e trimis greșit pe /subscribe deși backend-ul îl lasă.
    // `tier` e tot owner-aware (owner → 'max'). UI-ul gateuiește pârghiile Pro/Max pe ASTA, nu pe
    // `subscription.tier` brut — care e null pentru owner (fără rând de abonament) → l-ar trata greșit ca Pro.
    const [entitled, tier] = await Promise.all([
      userHasEntitlement(req.user!.id),
      userTier(req.user!.id),
    ])
    return reply.send({ subscription: sub ?? null, entitled, tier })
  })
}
