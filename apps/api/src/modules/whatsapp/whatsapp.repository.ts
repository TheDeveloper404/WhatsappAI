import { eq } from 'drizzle-orm'
import { db } from '../../config/database.js'
import { whatsappSessions, type WhatsappSession, type NewWhatsappSession } from '../../db/schema.js'

export const whatsappRepository = {
  async findByUserId(userId: string): Promise<WhatsappSession | undefined> {
    const rows = await db.select().from(whatsappSessions).where(eq(whatsappSessions.userId, userId))
    return rows[0]
  },

  async upsert(data: NewWhatsappSession): Promise<WhatsappSession> {
    const existing = await this.findByUserId(data.userId)
    if (existing) {
      await db
        .update(whatsappSessions)
        .set({ ...data, updatedAt: Date.now() })
        .where(eq(whatsappSessions.userId, data.userId))
    } else {
      await db.insert(whatsappSessions).values(data)
    }
    const rows = await db.select().from(whatsappSessions).where(eq(whatsappSessions.userId, data.userId))
    return rows[0]!
  },

  async update(userId: string, data: Partial<WhatsappSession>): Promise<void> {
    await db
      .update(whatsappSessions)
      .set({ ...data, updatedAt: Date.now() })
      .where(eq(whatsappSessions.userId, userId))
  },

  async findAllConnected(): Promise<WhatsappSession[]> {
    return db.select().from(whatsappSessions).where(eq(whatsappSessions.status, 'connected'))
  },
}
