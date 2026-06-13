import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { billingService } from './billing.service.js'
import { userHasEntitlement } from './entitlement.js'
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

  app.get('/subscription', { preHandler: authenticate }, async (req, reply) => {
    const sub = await billingService.getSubscription(req.user!.id)
    // `entitled` = owner-aware (bypass OWNER_EMAIL inclus prin userHasEntitlement), aceeași sursă de
    // adevăr ca gate-ul de 402. UI-ul gateuiește pe ASTA, nu pe statusul brut al abonamentului — altfel
    // owner-ul (fără rând de abonament) e trimis greșit pe /subscribe deși backend-ul îl lasă.
    const entitled = await userHasEntitlement(req.user!.id)
    return reply.send({ subscription: sub ?? null, entitled })
  })
}
