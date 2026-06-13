import type { FastifyRequest, FastifyReply } from 'fastify'
import { userHasEntitlement } from '../modules/billing/entitlement.js'
import { Errors } from '../utils/errors.js'
import { env } from '../config/env.js'

// preHandler de AUTORIZARE (entitlement). TREBUIE să ruleze DUPĂ `authenticate` în array-ul de
// preHandler — depinde de `req.user` populat de acolo. Răspunde 402 + `SUBSCRIPTION_REQUIRED`
// ca frontend-ul să-l distingă de 401 (sesiune expirată) și să redirecționeze la /subscribe.
//
// Authenticate = „cine ești?"; aceasta = „ai voie, în starea ta curentă de abonament?".
// OWNER_EMAIL (env Railway) → bypass complet: owner-ul folosește propria aplicație fără abonament.
export async function requireActiveSubscription(req: FastifyRequest, _reply: FastifyReply) {
  const userId = req.user?.id
  if (!userId) throw Errors.unauthorized('Missing access token.')
  // Comparație case-insensitive (F-OWN-01): `OWNER_EMAIL` e deja lowercased în env, iar emailul userului
  // e lowercased la register — `toLowerCase()` aici e o plasă suplimentară contra datelor legacy.
  if (env.OWNER_EMAIL && req.user?.email?.toLowerCase() === env.OWNER_EMAIL) return
  if (!(await userHasEntitlement(userId))) throw Errors.subscriptionRequired()
}
