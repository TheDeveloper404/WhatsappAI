import type { FastifyInstance } from 'fastify'
import type Stripe from 'stripe'
import { stripe } from '../../config/stripe.js'
import { env } from '../../config/env.js'
import { billingRepository } from '../billing/billing.repository.js'
import { adminRepository } from '../admin/admin.repository.js'
import { notifyAdmin } from '../admin/notifications.service.js'

export async function stripeWebhookRoutes(app: FastifyInstance) {
  // Raw body needed for Stripe signature verification
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body)
  })

  app.post('/stripe', async (req, reply) => {
    const sig = req.headers['stripe-signature']

    if (!sig) return reply.status(400).send({ error: 'Missing stripe-signature header' })

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, env.STRIPE_WEBHOOK_SECRET)
    } catch {
      return reply.status(400).send({ error: 'Invalid webhook signature' })
    }

    await handleEvent(event, app)
    return reply.status(200).send({ received: true })
  })
}

async function handleEvent(event: Stripe.Event, app: FastifyInstance) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') break

      const stripeSubscriptionId = session.subscription as string
      const customerId = session.customer as string
      const plan = (session.metadata?.plan ?? 'monthly') as 'monthly' | 'annual'

      const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId)
      const trialEnd = stripeSub.trial_end ? stripeSub.trial_end * 1000 : null
      const periodEnd = stripeSub.billing_cycle_anchor * 1000
      const status = stripeSub.status === 'trialing' ? 'trialing' : 'active'

      const existing = await billingRepository.findByStripeCustomerId(customerId)
      if (existing) {
        await billingRepository.update(existing.id, {
          stripeSubscriptionId,
          plan,
          status,
          trialEndsAt: trialEnd,
          currentPeriodEndsAt: periodEnd,
        })
      }
      break
    }

    case 'customer.subscription.updated': {
      const stripeSub = event.data.object as Stripe.Subscription
      const existing = await billingRepository.findByStripeSubscriptionId(stripeSub.id)
      if (!existing) break

      const statusMap: Record<string, 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'> = {
        trialing: 'trialing',
        active: 'active',
        past_due: 'past_due',
        canceled: 'canceled',
        incomplete: 'incomplete',
      }
      const status = statusMap[stripeSub.status] ?? 'incomplete'

      await billingRepository.update(existing.id, {
        status,
        trialEndsAt: stripeSub.trial_end ? stripeSub.trial_end * 1000 : null,
        currentPeriodEndsAt: stripeSub.billing_cycle_anchor * 1000,
      })

      if (status === 'past_due' || status === 'canceled') {
        await adminRepository.setAgentActive(existing.userId, false)
        await notifyAdmin(
          status === 'past_due' ? 'payment_failed' : 'subscription_canceled',
          status === 'past_due' ? 'Plată eșuată' : 'Abonament anulat',
          `User ID: ${existing.userId}\nStatus nou: ${status}`
        )
      }
      break
    }

    case 'customer.subscription.deleted': {
      const stripeSub = event.data.object as Stripe.Subscription
      const existing = await billingRepository.findByStripeSubscriptionId(stripeSub.id)
      if (existing) {
        await billingRepository.update(existing.id, { status: 'canceled' })
        await adminRepository.setAgentActive(existing.userId, false)
        await notifyAdmin(
          'subscription_canceled',
          'Abonament anulat',
          `User ID: ${existing.userId}\nAbonamentul a fost șters din Stripe.`
        )
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      const existing = await billingRepository.findByStripeCustomerId(customerId)
      if (existing) {
        await billingRepository.update(existing.id, { status: 'past_due' })
        await adminRepository.setAgentActive(existing.userId, false)
        await notifyAdmin(
          'payment_failed',
          'Plată eșuată',
          `User ID: ${existing.userId}\nFactura: ${invoice.id}`
        )
      }
      break
    }

    default:
      app.log.info(`Unhandled Stripe event: ${event.type}`)
  }
}
