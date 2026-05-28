import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'

// Stripe mock — include webhooks.constructEvent + subscriptions.retrieve
vi.mock('../../config/stripe.js', () => ({
  stripe: {
    customers: { create: vi.fn().mockResolvedValue({ id: 'cus_test' }) },
    checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }) } },
    billingPortal: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/test' }) } },
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue({
        id: 'sub_test123',
        status: 'trialing',
        trial_end: Math.floor(Date.now() / 1000) + 7 * 86400,
        billing_cycle_anchor: Math.floor(Date.now() / 1000) + 30 * 86400,
      }),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}))

vi.mock('../../utils/email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendAdminNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendCustomEmail: vi.fn().mockResolvedValue(undefined),
}))

import { stripe } from '../../config/stripe.js'
import { sendVerificationEmail } from '../../utils/email.js'
import { db } from '../../config/database.js'
import { subscriptions, aiSettings } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function registerAndLogin(email: string) {
  vi.mocked(sendVerificationEmail).mockClear()
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { name: 'Webhook User', email, password: 'Password123!' },
  })
  const [, , token] = vi.mocked(sendVerificationEmail).mock.calls[0] as [string, string, string]
  await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token } })
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'Password123!' },
  })
  return res.json() as { accessToken: string; user: { id: string } }
}

async function createSubscription(userId: string, opts: {
  stripeCustomerId: string
  stripeSubscriptionId: string
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
}) {
  const now = Date.now()
  await db.insert(subscriptions).values({
    id: randomUUID(),
    userId,
    stripeCustomerId: opts.stripeCustomerId,
    stripeSubscriptionId: opts.stripeSubscriptionId,
    plan: 'monthly',
    status: opts.status,
    trialEndsAt: now + 7 * 86_400_000,
    currentPeriodEndsAt: now + 30 * 86_400_000,
    createdAt: now,
    updatedAt: now,
  })
}

async function activateAgent(userId: string) {
  // auto-create ai_settings via GET (și activăm agentul direct în DB)
  await app.inject({ method: 'GET', url: '/api/v1/ai/settings' })
  const now = Date.now()
  await db.insert(aiSettings).values({
    id: randomUUID(), userId, isActive: true, adminDisabled: false,
    timerMinutes: 5, systemPrompt: 'test', pauseUntil: null,
    createdAt: now, updatedAt: now,
  }).onConflictDoUpdate({
    target: aiSettings.userId,
    set: { isActive: true, adminDisabled: false, updatedAt: now },
  })
}

function sendWebhook(event: object) {
  // constructEvent este mock-uit să returneze event-ul direct
  vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(event as any)
  return app.inject({
    method: 'POST',
    url: '/webhooks/stripe',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': 'test_sig',
    },
    payload: Buffer.from(JSON.stringify(event)),
  })
}

// ---------------------------------------------------------------------------
// POST /webhooks/stripe — semnătură
// ---------------------------------------------------------------------------

describe('POST /webhooks/stripe — semnătură', () => {
  it('400 — lipsește stripe-signature header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload: Buffer.from('{}'),
    })
    expect(res.statusCode).toBe(400)
  })

  it('400 — semnătură invalidă (constructEvent aruncă)', async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockImplementationOnce(() => {
      throw new Error('Invalid signature')
    })
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'bad_sig' },
      payload: Buffer.from('{}'),
    })
    expect(res.statusCode).toBe(400)
  })

  it('200 — semnătură validă returnează received: true', async () => {
    const res = await sendWebhook({ type: 'unknown.event', data: { object: {} } })
    expect(res.statusCode).toBe(200)
    expect(res.json().received).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// checkout.session.completed
// ---------------------------------------------------------------------------

describe('checkout.session.completed', () => {
  it('200 — actualizează subscripția cu stripeSubscriptionId și status trialing', async () => {
    const { user } = await registerAndLogin('webhook-checkout@test.com')
    await createSubscription(user.id, {
      stripeCustomerId: 'cus_checkout_test',
      stripeSubscriptionId: null as any,
      status: 'incomplete',
    })

    vi.mocked(stripe.subscriptions.retrieve).mockResolvedValueOnce({
      id: 'sub_checkout_new',
      status: 'trialing',
      trial_end: Math.floor(Date.now() / 1000) + 7 * 86400,
      billing_cycle_anchor: Math.floor(Date.now() / 1000) + 30 * 86400,
    } as any)

    const res = await sendWebhook({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          subscription: 'sub_checkout_new',
          customer: 'cus_checkout_test',
          metadata: { userId: user.id, plan: 'monthly' },
        },
      },
    })
    expect(res.statusCode).toBe(200)

    const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id))
    expect(rows[0].stripeSubscriptionId).toBe('sub_checkout_new')
    expect(rows[0].status).toBe('trialing')
  })

  it('200 — ignoră sesiunile non-subscription (payment mode)', async () => {
    const res = await sendWebhook({
      type: 'checkout.session.completed',
      data: { object: { mode: 'payment', customer: 'cus_other' } },
    })
    expect(res.statusCode).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// customer.subscription.updated — past_due
// ---------------------------------------------------------------------------

describe('customer.subscription.updated', () => {
  it('200 — past_due dezactivează agentul și setează adminDisabled', async () => {
    const { user } = await registerAndLogin('webhook-past-due@test.com')
    await createSubscription(user.id, {
      stripeCustomerId: 'cus_past_due',
      stripeSubscriptionId: 'sub_past_due',
      status: 'active',
    })
    await activateAgent(user.id)

    const res = await sendWebhook({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_past_due',
          status: 'past_due',
          trial_end: null,
          billing_cycle_anchor: Math.floor(Date.now() / 1000),
        },
      },
    })
    expect(res.statusCode).toBe(200)

    const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id))
    expect(rows[0].status).toBe('past_due')

    const agentRows = await db.select().from(aiSettings).where(eq(aiSettings.userId, user.id))
    expect(agentRows[0].isActive).toBe(false)
    expect(agentRows[0].adminDisabled).toBe(true)
  })

  it('200 — active nu dezactivează agentul', async () => {
    const { user } = await registerAndLogin('webhook-active@test.com')
    await createSubscription(user.id, {
      stripeCustomerId: 'cus_active_upd',
      stripeSubscriptionId: 'sub_active_upd',
      status: 'trialing',
    })
    await activateAgent(user.id)

    const res = await sendWebhook({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_active_upd',
          status: 'active',
          trial_end: null,
          billing_cycle_anchor: Math.floor(Date.now() / 1000),
        },
      },
    })
    expect(res.statusCode).toBe(200)

    const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id))
    expect(rows[0].status).toBe('active')

    const agentRows = await db.select().from(aiSettings).where(eq(aiSettings.userId, user.id))
    expect(agentRows[0].isActive).toBe(true)
  })

  it('200 — cancel_at_period_end marchează anularea la final fără dezactivare imediată', async () => {
    const { user } = await registerAndLogin('webhook-cancel-at-end@test.com')
    await createSubscription(user.id, {
      stripeCustomerId: 'cus_cancel_at_end',
      stripeSubscriptionId: 'sub_cancel_at_end',
      status: 'trialing',
    })
    await activateAgent(user.id)

    const cancelAt = Math.floor(Date.now() / 1000) + 7 * 86400
    const res = await sendWebhook({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_cancel_at_end',
          status: 'trialing',
          trial_end: cancelAt,
          current_period_end: cancelAt,
          billing_cycle_anchor: Math.floor(Date.now() / 1000),
          cancel_at_period_end: true,
          cancel_at: cancelAt,
        },
      },
    })
    expect(res.statusCode).toBe(200)

    const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id))
    expect(rows[0].status).toBe('trialing')
    expect(rows[0].cancelAtPeriodEnd).toBe(true)
    expect(rows[0].cancelAt).toBe(cancelAt * 1000)

    const agentRows = await db.select().from(aiSettings).where(eq(aiSettings.userId, user.id))
    expect(agentRows[0].isActive).toBe(true)
  })

  it('200 — subscription inexistentă în DB este ignorată', async () => {
    const res = await sendWebhook({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_nonexistent_xyz',
          status: 'past_due',
          trial_end: null,
          billing_cycle_anchor: Math.floor(Date.now() / 1000),
        },
      },
    })
    expect(res.statusCode).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// customer.subscription.deleted
// ---------------------------------------------------------------------------

describe('customer.subscription.deleted', () => {
  it('200 — anulează subscripția și dezactivează agentul', async () => {
    const { user } = await registerAndLogin('webhook-deleted@test.com')
    await createSubscription(user.id, {
      stripeCustomerId: 'cus_deleted',
      stripeSubscriptionId: 'sub_deleted',
      status: 'active',
    })
    await activateAgent(user.id)

    const res = await sendWebhook({
      type: 'customer.subscription.deleted',
      data: {
        object: { id: 'sub_deleted' },
      },
    })
    expect(res.statusCode).toBe(200)

    const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id))
    expect(rows[0].status).toBe('canceled')

    const agentRows = await db.select().from(aiSettings).where(eq(aiSettings.userId, user.id))
    expect(agentRows[0].isActive).toBe(false)
    expect(agentRows[0].adminDisabled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// invoice.payment_failed
// ---------------------------------------------------------------------------

describe('invoice.payment_failed', () => {
  it('200 — setează past_due și dezactivează agentul', async () => {
    const { user } = await registerAndLogin('webhook-invoice-fail@test.com')
    await createSubscription(user.id, {
      stripeCustomerId: 'cus_invoice_fail',
      stripeSubscriptionId: 'sub_invoice_fail',
      status: 'active',
    })
    await activateAgent(user.id)

    const res = await sendWebhook({
      type: 'invoice.payment_failed',
      data: {
        object: {
          customer: 'cus_invoice_fail',
          id: 'inv_test123',
        },
      },
    })
    expect(res.statusCode).toBe(200)

    const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id))
    expect(rows[0].status).toBe('past_due')

    const agentRows = await db.select().from(aiSettings).where(eq(aiSettings.userId, user.id))
    expect(agentRows[0].isActive).toBe(false)
    expect(agentRows[0].adminDisabled).toBe(true)
  })

  it('200 — customer inexistent în DB este ignorat', async () => {
    const res = await sendWebhook({
      type: 'invoice.payment_failed',
      data: {
        object: { customer: 'cus_nobody', id: 'inv_nobody' },
      },
    })
    expect(res.statusCode).toBe(200)
  })
})
