import { randomUUID } from 'crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '../../config/database.js'
import { notifications } from '../../db/schema.js'
import type { Notification } from '../../db/schema.js'

// Notificări în-app scopate pe user (B15). Tabela `notifications` e generică (vezi schema.ts):
// admin-ul are propriile rute în modulul admin; aici e exclusiv calea user-facing, scopată pe `userId`.
export const notificationsRepository = {
  // Creare — folosit de evenimente de cont (azi: extindere trial din admin). `userId` = destinatarul.
  async create(userId: string, type: string, title: string, body: string): Promise<void> {
    await db.insert(notifications).values({
      id: randomUUID(), userId, type, title, body, readAt: null, createdAt: Date.now(),
    })
  },

  async listForUser(userId: string): Promise<Notification[]> {
    return db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50)
  },

  async unreadCount(userId: string): Promise<number> {
    const rows = await db.select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    return rows.length
  },

  async markAllRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ readAt: Date.now() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
  },
}
