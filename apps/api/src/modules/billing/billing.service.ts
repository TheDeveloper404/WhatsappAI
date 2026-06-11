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
}
