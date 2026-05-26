import { eq } from 'drizzle-orm'
import { db } from '../../config/database.js'
import { users } from '../../db/schema.js'
import { adminRepository } from './admin.repository.js'
import { sendAdminNotificationEmail } from '../../utils/email.js'
import { env } from '../../config/env.js'
import { logger } from '../../utils/logger.js'

async function getAdminUserId(): Promise<string | null> {
  if (!env.ADMIN_EMAIL) return null
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, env.ADMIN_EMAIL))
  return rows[0]?.id ?? null
}

export async function notifyAdmin(type: string, title: string, body: string): Promise<void> {
  try {
    const adminId = await getAdminUserId()
    if (adminId) {
      await adminRepository.createNotification(adminId, type, title, body)
    }
    if (env.ADMIN_EMAIL) {
      await sendAdminNotificationEmail(env.ADMIN_EMAIL, title, body)
    }
  } catch (err) {
    logger.error('[admin] notificare eșuată', { err: String(err) })
  }
}
