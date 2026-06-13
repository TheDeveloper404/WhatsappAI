import type { FastifyInstance } from 'fastify'
import type Stripe from 'stripe'
import { stripe } from '../../config/stripe.js'
import { env } from '../../config/env.js'
import { pool } from '../../config/database.js'
import { billingRepository } from '../billing/billing.repository.js'
import { priceMeta } from '../billing/billing.service.js'
import { adminRepository } from '../admin/admin.repository.js'
import { notifyAdmin } from '../admin/notifications.service.js'

export async function stripeWebhookRoutes(app: FastifyInstance) {
  // Raw body needed for Stripe signature verification.
  // Acest scope (înregistrat cu prefix `/webhooks`) moștenește parser-ul `application/json` custom
  // definit la root (în `app.ts`); îl eliminăm aici înainte de a-l înlocui cu varianta `buffer`,
  // altfel `addContentTypeParser` aruncă FST_ERR_CTP_ALREADY_PRESENT la boot.
  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body)
  })

  // Exceptat de la rate limit-ul global: Stripe livrează de pe multe IP-uri și retrimite agresiv;
  // un limit per-IP ar putea pierde evenimente de plată. Protecția reală e verificarea semnăturii
  // pe raw buffer + deduplicarea prin `stripe_events`.
  app.post('/stripe', { config: { rateLimit: false } }, async (req, reply) => {
    const sig = req.headers['stripe-signature']

    if (!sig) return reply.status(400).send({ error: 'Missing stripe-signature header' })

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, env.STRIPE_WEBHOOK_SECRET)
    } catch {
      return reply.status(400).send({ error: 'Invalid webhook signature' })
    }

    // Deduplicare: Stripe poate retrimite același eveniment (at-least-once delivery).
    // Dacă l-am procesat deja, confirmăm fără să re-rulăm handler-ul.
    // Doar dacă event.id există — fără cheie nu putem dedupe (un event valid Stripe
    // are mereu id; sărim peste dedup în loc să dăm 500 și să forțăm retry inutil).
    if (event.id) {
      const inserted = await pool.query(
        `INSERT INTO stripe_events (id, type, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
        [event.id, event.type, Date.now()],
      )
      if (inserted.rowCount === 0) {
        return reply.status(200).send({ received: true, duplicate: true })
      }
    }

    await handleEvent(event, app)
    return reply.status(200).send({ received: true })
  })
}

// Stripe NU garantează ordinea livrării (M7). Ignorăm evenimentele mai vechi decât starea curentă,
// comparând `event.created` cu `last_event_at` salvat per abonament.
function isStaleEvent(lastEventAt: number | null | undefined, eventAt: number): boolean {
  return lastEventAt != null && eventAt < lastEventAt
}

async function handleEvent(event: Stripe.Event, app: FastifyInstance) {
  // event.created e în secunde. Stripe îl trimite mereu, dar ne apărăm defensiv: un `created` lipsă/
  // nevalid ar produce NaN → eroare la scrierea în coloana BIGINT `last_event_at`. Fallback la „acum"
  // (tratat ca cel mai nou eveniment, deci aplicat — comportament pre-M7), niciodată NaN.
  const eventAt = Number.isFinite(event.created) ? event.created * 1000 : Date.now()

  const getCurrentPeriodEnd = (stripeSub: Stripe.Subscription) => {
    const sub = stripeSub as Stripe.Subscription & { current_period_end?: number }
    return (sub.current_period_end ?? stripeSub.billing_cycle_anchor) * 1000
  }

  const getCancelAt = (stripeSub: Stripe.Subscription) => {
    const sub = stripeSub as Stripe.Subscription & { cancel_at?: number | null }
    return sub.cancel_at ? sub.cancel_at * 1000 : null
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') break

      const stripeSubscriptionId = session.subscription as string
      const customerId = session.customer as string
      const plan = (session.metadata?.plan ?? 'monthly') as 'monthly' | 'annual'
      // Tier-ul ales la checkout (metadata setată de billing.service). Fail-closed: orice ≠ 'max'
      // → 'pro'. Setat aici ca webhook-ul să fie autoritativ și la re-abonare la alt tier (cazul în
      // care rândul există deja, deci billing.service NU l-a re-creat cu tier-ul nou).
      const tier = session.metadata?.tier === 'max' ? 'max' : 'pro'

      const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId)
      const trialEnd = stripeSub.trial_end ? stripeSub.trial_end * 1000 : null
      const periodEnd = getCurrentPeriodEnd(stripeSub)
      const status = stripeSub.status === 'trialing' ? 'trialing' : 'active'

      const existing = await billingRepository.findByStripeCustomerId(customerId)
      if (existing && !isStaleEvent(existing.lastEventAt, eventAt)) {
        await billingRepository.update(existing.id, {
          stripeSubscriptionId,
          plan,
          tier,
          status,
          trialEndsAt: trialEnd,
          currentPeriodEndsAt: periodEnd,
          cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
          cancelAt: getCancelAt(stripeSub),
          lastEventAt: eventAt,
        })
      }
      break
    }

    case 'customer.subscription.updated': {
      const stripeSub = event.data.object as Stripe.Subscription
      const existing = await billingRepository.findByStripeSubscriptionId(stripeSub.id)
      if (!existing) break
      if (isStaleEvent(existing.lastEventAt, eventAt)) break // eveniment mai vechi → ignoră (M7)

      const statusMap: Record<string, 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'> = {
        trialing: 'trialing',
        active: 'active',
        past_due: 'past_due',
        canceled: 'canceled',
        incomplete: 'incomplete',
      }
      const status = statusMap[stripeSub.status] ?? 'incomplete'

      // Reflectă schimbarea de tier/plan din price-ul curent (ex. upgrade Pro→Max prin
      // `subscriptions.update` sau portal). `null` = price nemapat → NU atingem tier/plan
      // (fail-safe: nu retrograda din cauza unui price necunoscut).
      const meta = priceMeta(stripeSub.items?.data?.[0]?.price?.id)

      await billingRepository.update(existing.id, {
        status,
        ...(meta ? { tier: meta.tier, plan: meta.plan } : {}),
        trialEndsAt: stripeSub.trial_end ? stripeSub.trial_end * 1000 : null,
        currentPeriodEndsAt: getCurrentPeriodEnd(stripeSub),
        cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
        cancelAt: getCancelAt(stripeSub),
        lastEventAt: eventAt,
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
      if (existing && !isStaleEvent(existing.lastEventAt, eventAt)) {
        await billingRepository.update(existing.id, {
          status: 'canceled',
          cancelAtPeriodEnd: false,
          cancelAt: Date.now(),
          lastEventAt: eventAt,
        })
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
      if (existing && !isStaleEvent(existing.lastEventAt, eventAt)) {
        await billingRepository.update(existing.id, { status: 'past_due', lastEventAt: eventAt })
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
