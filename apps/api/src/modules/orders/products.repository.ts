import { randomUUID } from 'crypto'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '../../config/database.js'
import { products } from '../../db/schema.js'
import type { Product } from '../../db/schema.js'

export const productsRepository = {
  async list(userId: string): Promise<Product[]> {
    return db.select()
      .from(products)
      .where(eq(products.userId, userId))
      .orderBy(asc(products.category), asc(products.name))
  },

  // Doar produsele disponibile — folosit la injectarea catalogului în prompt-ul AI
  async listAvailable(userId: string): Promise<Product[]> {
    return db.select()
      .from(products)
      .where(and(eq(products.userId, userId), eq(products.isAvailable, true)))
      .orderBy(asc(products.category), asc(products.name))
  },

  async findById(userId: string, id: string): Promise<Product | null> {
    const rows = await db.select()
      .from(products)
      .where(and(eq(products.userId, userId), eq(products.id, id)))
    return rows[0] ?? null
  },

  async create(userId: string, data: {
    name: string; description: string; priceBani: number; category: string; isAvailable: boolean
  }): Promise<Product> {
    const now = Date.now()
    const row = {
      id: randomUUID(),
      userId,
      name: data.name,
      description: data.description,
      priceBani: data.priceBani,
      category: data.category,
      isAvailable: data.isAvailable,
      createdAt: now,
      updatedAt: now,
    }
    await db.insert(products).values(row)
    return row
  },

  async update(userId: string, id: string, data: Partial<{
    name: string; description: string; priceBani: number; category: string; isAvailable: boolean
  }>): Promise<void> {
    await db.update(products)
      .set({ ...data, updatedAt: Date.now() })
      .where(and(eq(products.userId, userId), eq(products.id, id)))
  },

  async remove(userId: string, id: string): Promise<void> {
    await db.delete(products)
      .where(and(eq(products.userId, userId), eq(products.id, id)))
  },
}
