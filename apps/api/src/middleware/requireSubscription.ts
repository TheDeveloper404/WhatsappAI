import type { FastifyRequest, FastifyReply } from 'fastify'
import { userHasEntitlement } from '../modules/billing/entitlement.js'
import { Errors } from '../utils/errors.js'

// preHandler de AUTORIZARE (entitlement). TREBUIE să ruleze DUPĂ `authenticate` în array-ul de
// preHandler — depinde de `req.user` populat de acolo. Răspunde 402 + `SUBSCRIPTION_REQUIRED`
// ca frontend-ul să-l distingă de 401 (sesiune expirată) și să redirecționeze la /subscribe.
//
// Authenticate = „cine ești?"; aceasta = „ai voie, în starea ta curentă de abonament?".
export async function requireActiveSubscription(req: FastifyRequest, _reply: FastifyReply) {
  const userId = req.user?.id
  if (!userId) throw Errors.unauthorized('Missing access token.')
  if (!(await userHasEntitlement(userId))) throw Errors.subscriptionRequired()
}
