import { randomUUID } from 'crypto'
import { stripe } from '../../config/stripe.js'
import { env } from '../../config/env.js'
import { billingRepository } from './billing.repository.js'
import { authRepository } from '../auth/auth.repository.js'
import { Errors } from '../../utils/errors.js'

export type PlanType = 'monthly' | 'annual'
export type Tier = 'pro' | 'max'

// (tier × plan) → price ID Stripe. Single source of truth pentru maparea de checkout.
const PRICE_IDS: Record<Tier, Record<PlanType, string>> = {
  pro: { monthly: env.STRIPE_PRICE_PRO_MONTHLY, annual: env.STRIPE_PRICE_PRO_ANNUAL },
  max: { monthly: env.STRIPE_PRICE_MAX_MONTHLY, annual: env.STRIPE_PRICE_MAX_ANNUAL },
}

// Hartă inversă price ID → (tier, plan), derivată din PRICE_IDS. Sursa de adevăr pentru webhook
// (`subscription.updated`, ca să reflecte schimbarea de tier/plan din price-ul real) și pentru
// `upgradeToMax`. Construită o singură dată la boot din aceleași env-uri.
const PRICE_META = new Map<string, { tier: Tier; plan: PlanType }>()
for (const t of ['pro', 'max'] as const) {
  for (const p of ['monthly', 'annual'] as const) {
    PRICE_META.set(PRICE_IDS[t][p], { tier: t, plan: p })
  }
}

// `null` = price necunoscut (legacy/test) → apelantul NU suprascrie tier/plan (fail-safe: nu retrograda
// un user din cauza unui price ID nemapat).
export function priceMeta(priceId: string | undefined | null): { tier: Tier; plan: PlanType } | null {
  if (!priceId) return null
  return PRICE_META.get(priceId) ?? null
}

export const billingService = {
  async createCheckoutSession(userId: string, plan: PlanType, tier: Tier) {
    const user = await authRepository.findUserById(userId)
    if (!user) throw Errors.notFound('User')

    const priceId = PRICE_IDS[tier][plan]

    let existing = await billingRepository.findByUserId(userId)
    let customerId = existing?.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId },
      })
      customerId = customer.id
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 7 },
      success_url: `${env.APP_URL}/dashboard?checkout=success`,
      cancel_url: `${env.APP_URL}/subscribe`,
      // `tier` în metadata = sursa pe care o citește webhook-ul (Felia 2b) la confirmare.
      metadata: { userId, plan, tier },
    })

    if (!existing) {
      const now = Date.now()
      await billingRepository.create({
        id: randomUUID(),
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: null,
        plan,
        tier,
        status: 'incomplete',
        trialEndsAt: null,
        currentPeriodEndsAt: null,
        createdAt: now,
        updatedAt: now,
      })
    }

    return { url: session.url! }
  },

  async createPortalSession(userId: string) {
    const sub = await billingRepository.findByUserId(userId)
    if (!sub) throw Errors.notFound('Subscription')

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${env.APP_URL}/dashboard`,
    })

    return { url: session.url }
  },

  async getSubscription(userId: string) {
    return billingRepository.findByUserId(userId)
  },

  // Upgrade in-place Pro → Max pe ABONAMENTUL EXISTENT (NU checkout nou — ăla ar crea un al doilea
  // abonament + alt trial). Schimbă price-ul liniei de abonament la Max pe ACEEAȘI perioadă
  // (lunar→lunar, anual→anual); Stripe calculează proration-ul și îl pune pe FACTURA URMĂTOARE
  // (`create_prorations`, fără debit imediat — decizie de produs). Webhook-ul `subscription.updated`
  // reconfirmă tier-ul din price (idempotent); scriem optimist aici doar pentru UX instant.
  async upgradeToMax(userId: string) {
    const sub = await billingRepository.findByUserId(userId)
    if (!sub || !sub.stripeSubscriptionId) throw Errors.notFound('Subscription')

    // Doar abonamentele utilizabile pot fi upgradate. incomplete/past_due/canceled → refuz.
    if (sub.status !== 'active' && sub.status !== 'trialing') {
      throw Errors.conflict('Abonamentul trebuie să fie activ pentru a face upgrade la Max.')
    }
    if (sub.tier === 'max') throw Errors.conflict('Ești deja pe planul Max.')

    // Perioada rămâne aceeași ca acum. Orice ≠ 'annual' → 'monthly' (fail-safe, consecvent cu subTier).
    const plan: PlanType = sub.plan === 'annual' ? 'annual' : 'monthly'
    const targetPriceId = PRICE_IDS.max[plan]

    // Item-ul curent (price-ul de schimbat) de pe abonamentul Stripe.
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId)
    const item = stripeSub.items.data[0]
    if (!item) throw Errors.conflict('Abonamentul Stripe nu are o linie de preț de actualizat.')

    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: item.id, price: targetPriceId }],
      proration_behavior: 'create_prorations',
    })

    await billingRepository.update(sub.id, { tier: 'max', plan })
    return { tier: 'max' as const, plan }
  },
}
