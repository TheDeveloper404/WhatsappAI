import type { FastifyRequest, FastifyReply } from 'fastify'
import { userTier } from '../modules/billing/entitlement.js'
import { Errors } from '../utils/errors.js'

// Rang de tier: un gate `requireTier('max')` cere rang ≥ Max. Future-proof dacă apar tiere noi.
const TIER_RANK: Record<'pro' | 'max', number> = { pro: 1, max: 2 }

// preHandler de AUTORIZARE pe TIER. TREBUIE pus DUPĂ `authenticate` ȘI `requireActiveSubscription`
// în array — dreptul de acces (entitlement) e verificat acolo; aici verificăm DOAR nivelul.
// Răspunde 403 + `TIER_REQUIRED` (≠ 402: userul are abonament, doar nu tier-ul potrivit).
// Fail-closed: tier necunoscut / fără abonament (null) → rang 0 → refuzat.
export function requireTier(min: 'pro' | 'max') {
  return async function requireTierHandler(req: FastifyRequest, _reply: FastifyReply) {
    const userId = req.user?.id
    if (!userId) throw Errors.unauthorized('Missing access token.')
    const tier = await userTier(userId)
    const rank = tier ? TIER_RANK[tier] : 0
    if (rank < TIER_RANK[min]) throw Errors.tierRequired()
  }
}
