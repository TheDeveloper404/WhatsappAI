import { randomUUID } from 'crypto'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../../config/database.js'
import { orders, orderItems } from '../../db/schema.js'
import type { Order, OrderItem } from '../../db/schema.js'

export type OrderItemInput = {
  productId: string
  productName: string
  unitPriceBani: number
  quantity: number
}

export const ordersRepository = {
  // Creează comanda + liniile ei. Totalul e calculat din prețurile primite
  // (care vin din DB, nu de la AI) — banii nu trec niciodată prin LLM.
  async create(userId: string, contactPhone: string, items: OrderItemInput[], customerNote: string): Promise<Order> {
    const now = Date.now()
    const totalBani = items.reduce((sum, it) => sum + it.unitPriceBani * it.quantity, 0)
    const order = {
      id: randomUUID(),
      userId,
      contactPhone,
      status: 'pending' as const,
      totalBani,
      customerNote,
      createdAt: now,
      updatedAt: now,
    }
    await db.insert(orders).values(order)
    await db.insert(orderItems).values(items.map(it => ({
      id: randomUUID(),
      orderId: order.id,
      productId: it.productId,
      productName: it.productName,
      unitPriceBani: it.unitPriceBani,
      quantity: it.quantity,
    })))
    return order
  },

  async list(userId: string): Promise<Order[]> {
    return db.select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
      .limit(200)
  },

  async getItems(orderId: string): Promise<OrderItem[]> {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  },

  async updateStatus(userId: string, orderId: string, status: 'pending' | 'confirmed' | 'completed' | 'cancelled'): Promise<void> {
    await db.update(orders)
      .set({ status, updatedAt: Date.now() })
      .where(and(eq(orders.userId, userId), eq(orders.id, orderId)))
  },

  async findById(userId: string, orderId: string): Promise<Order | null> {
    const rows = await db.select()
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.id, orderId)))
    return rows[0] ?? null
  },
}
