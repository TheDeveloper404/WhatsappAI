import { randomUUID } from 'crypto'
import { eq, and, asc } from 'drizzle-orm'
import { db, pool } from '../../config/database.js'
import { products } from '../../db/schema.js'
import type { Product } from '../../db/schema.js'

export const productsRepository = {
  async list(userId: string): Promise<Product[]> {
    return db.select()
      .from(products)
      .where(eq(products.userId, userId))
      .orderBy(asc(products.category), asc(products.name))
  },

  // Numărul de produse ale userului (pentru plafonul de tier). Scopat pe userId.
  async countForUser(userId: string): Promise<number> {
    const res = await pool.query('SELECT COUNT(*)::int AS n FROM products WHERE user_id = $1', [userId])
    return res.rows[0].n as number
  },

  async findById(userId: string, id: string): Promise<Product | null> {
    const rows = await db.select()
      .from(products)
      .where(and(eq(products.userId, userId), eq(products.id, id)))
    return rows[0] ?? null
  },

  async create(userId: string, data: {
    name: string; description: string; priceBani: number; category: string; isAvailable: boolean; isEstimate?: boolean; isBookable?: boolean; stock?: number | null
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
      isEstimate: data.isEstimate ?? false,
      isBookable: data.isBookable ?? false,
      stock: data.stock ?? null,
      createdAt: now,
      updatedAt: now,
    }
    await db.insert(products).values(row)
    return row
  },

  // Import în masă (CSV). Inserează toate produsele primite într-un singur batch.
  async createMany(userId: string, items: Array<{
    name: string; description: string; priceBani: number; category: string; isAvailable: boolean; isEstimate?: boolean; isBookable?: boolean; stock?: number | null
  }>): Promise<number> {
    if (items.length === 0) return 0
    const now = Date.now()
    const rows = items.map(it => ({
      id: randomUUID(),
      userId,
      name: it.name,
      description: it.description,
      priceBani: it.priceBani,
      category: it.category,
      isAvailable: it.isAvailable,
      isEstimate: it.isEstimate ?? false,
      isBookable: it.isBookable ?? false,
      stock: it.stock ?? null,
      createdAt: now,
      updatedAt: now,
    }))
    await db.insert(products).values(rows)
    return rows.length
  },

  async update(userId: string, id: string, data: Partial<{
    name: string; description: string; priceBani: number; category: string; isAvailable: boolean; isEstimate: boolean; isBookable: boolean; stock: number | null
  }>): Promise<void> {
    await db.update(products)
      .set({ ...data, updatedAt: Date.now() })
      .where(and(eq(products.userId, userId), eq(products.id, id)))
  },

  // Returnează true dacă a șters efectiv un rând. WHERE include userId, deci ștergerea
  // unui produs care nu-ți aparține (sau inexistent) nu afectează nimic → false (BOLA-safe).
  async remove(userId: string, id: string): Promise<boolean> {
    const res = await pool.query(
      'DELETE FROM products WHERE user_id = $1 AND id = $2',
      [userId, id],
    )
    return (res.rowCount ?? 0) > 0
  },

  // Scădere atomică de stoc la confirmarea comenzii. Condiția `stock >= qty` în WHERE
  // previne race-ul (2 clienți pe ultimul produs): doar primul update reușește.
  // Produsele cu stock NULL (nelimitat) nu sunt afectate. Returnează true dacă a scăzut.
  async decrementStock(userId: string, productId: string, qty: number): Promise<boolean> {
    const res = await pool.query(
      `UPDATE products SET stock = stock - $1, updated_at = $2
       WHERE user_id = $3 AND id = $4 AND stock IS NOT NULL AND stock >= $1`,
      [qty, Date.now(), userId, productId],
    )
    return (res.rowCount ?? 0) > 0
  },
}
