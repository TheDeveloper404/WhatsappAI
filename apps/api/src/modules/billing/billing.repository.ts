import { eq } from 'drizzle-orm'
import { db } from '../../config/database.js'
import { subscriptions, type Subscription, type NewSubscription } from '../../db/schema.js'

export const billingRepository = {
  async findByUserId(userId: string): Promise<Subscription | undefined> {
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId))
    return rows[0]
  },

  async findByStripeCustomerId(customerId: string): Promise<Subscription | undefined> {
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.stripeCustomerId, customerId))
    return rows[0]
  },

  async findByStripeSubscriptionId(subscriptionId: string): Promise<Subscription | undefined> {
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    return rows[0]
  },

  async create(data: NewSubscription): Promise<Subscription> {
    await db.insert(subscriptions).values(data)
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.id, data.id))
    return rows[0]!
  },

  async update(id: string, data: Partial<Subscription>): Promise<void> {
    await db.update(subscriptions).set({ ...data, updatedAt: Date.now() }).where(eq(subscriptions.id, id))
  },
}
