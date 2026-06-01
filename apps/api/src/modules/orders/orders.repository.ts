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

// Referință scurtă lizibilă pentru client (ex. „ord_a1b2c3"). Doar hex → fără caractere ambigue.
// Suficient de unică la volumul nostru; coliziunea ar afecta doar afișarea, nu integritatea (id-ul rămâne UUID).
function genPublicRef(): string {
  return 'ord_' + randomUUID().replace(/-/g, '').slice(0, 6)
}

export const ordersRepository = {
  // Creează comanda + liniile ei. Totalul e calculat din prețurile primite
  // (care vin din DB, nu de la AI) — banii nu trec niciodată prin LLM.
  async create(userId: string, contactPhone: string, items: OrderItemInput[], customerNote: string, details = ''): Promise<Order> {
    const now = Date.now()
    const totalBani = items.reduce((sum, it) => sum + it.unitPriceBani * it.quantity, 0)
    const order = {
      id: randomUUID(),
      publicRef: genPublicRef(),
      userId,
      contactPhone,
      status: 'pending' as const,
      totalBani,
      customerNote,
      details,
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

  // Șterge comanda (liniile ei cad prin ON DELETE CASCADE).
  async delete(userId: string, orderId: string): Promise<void> {
    await db.delete(orders)
      .where(and(eq(orders.userId, userId), eq(orders.id, orderId)))
  },

  // Ultimele comenzi ale unui contact (pentru detectarea dublurilor înainte de a crea una nouă).
  async listRecentForContact(userId: string, contactPhone: string, limit = 10): Promise<Order[]> {
    return db.select()
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.contactPhone, contactPhone)))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
  },
}
