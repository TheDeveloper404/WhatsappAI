import { randomUUID } from 'crypto'
import { eq, and, desc } from 'drizzle-orm'
import { db, pool } from '../../config/database.js'
import { aiSettings, contactsBlacklist, conversationMessages, contactMemory } from '../../db/schema.js'
import type { AiSettings } from '../../db/schema.js'

const DEFAULT_PROMPT = 'Ești un asistent WhatsApp care răspunde în numele proprietarului acestui număr.\n\nComportament:\n- Răspunsuri scurte și naturale: 1-2 propoziții\n- Ton prietenos, politicos și respectuos\n- La salut sau mesaj vag, răspunzi călduros și întrebi cum poți ajuta\n- Folosești diacritice corecte: ă, â, î, ș, ț\n\nReguli:\n- NU folosești fraze robotice: "Desigur!", "Cu plăcere!", "Bineînțeles!"\n- NU repeta aceleași structuri de la un mesaj la altul\n\nLimba: răspunzi în limba în care ți se scrie.\n\n— Personalizează acest prompt din pagina Setări.'

export const aiRepository = {
  async getSettings(userId: string): Promise<AiSettings> {
    const now = Date.now()
    try {
      await db.insert(aiSettings).values({
        id: randomUUID(), userId,
        isActive: false,
        adminDisabled: false,
        timerMinutes: 5,
        systemPrompt: DEFAULT_PROMPT,
        knowledgeBase: '',
        writingStyle: '',
        pauseUntil: null,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing()
    } catch {
      // INSERT poate eșua dacă rândul există deja cu conflict non-unicitate (ex: schema veche)
      // SELECT-ul de mai jos va returna rândul existent
    }
    const rows = await db.select().from(aiSettings).where(eq(aiSettings.userId, userId))
    if (!rows[0]) throw new Error(`ai_settings lipsă pentru userId=${userId}`)
    return rows[0]
  },

  async updateSettings(userId: string, data: Partial<Pick<AiSettings, 'isActive' | 'adminDisabled' | 'timerMinutes' | 'systemPrompt' | 'knowledgeBase' | 'writingStyle' | 'pauseUntil'>>): Promise<void> {
    await this.getSettings(userId)
    await db.update(aiSettings)
      .set({ ...data, updatedAt: Date.now() })
      .where(eq(aiSettings.userId, userId))
  },

  async isBlacklisted(userId: string, phoneNumber: string): Promise<boolean> {
    const rows = await db.select().from(contactsBlacklist)
      .where(and(eq(contactsBlacklist.userId, userId), eq(contactsBlacklist.phoneNumber, phoneNumber)))
    return rows.length > 0
  },

  async addBlacklist(userId: string, phoneNumber: string): Promise<void> {
    await db.insert(contactsBlacklist).values({
      id: randomUUID(), userId, phoneNumber, createdAt: Date.now(),
    }).onConflictDoNothing()
  },

  async removeBlacklist(userId: string, phoneNumber: string): Promise<void> {
    await db.delete(contactsBlacklist)
      .where(and(eq(contactsBlacklist.userId, userId), eq(contactsBlacklist.phoneNumber, phoneNumber)))
  },

  async getBlacklist(userId: string): Promise<string[]> {
    const rows = await db.select().from(contactsBlacklist).where(eq(contactsBlacklist.userId, userId))
    return rows.map(r => r.phoneNumber)
  },

  async saveMessage(userId: string, contactPhone: string, fromMe: boolean, body: string, waTimestamp: number): Promise<void> {
    await db.insert(conversationMessages).values({
      id: randomUUID(), userId, contactPhone, fromMe, body, waTimestamp, createdAt: Date.now(),
    })
    // Șterge mesajele dincolo de ultimele 50 într-o singură interogare
    await pool.query(`
      DELETE FROM conversation_messages
      WHERE user_id = $1 AND contact_phone = $2
      AND id NOT IN (
        SELECT id FROM conversation_messages
        WHERE user_id = $1 AND contact_phone = $2
        ORDER BY wa_timestamp DESC
        LIMIT 50
      )
    `, [userId, contactPhone])
  },

  async clearHistory(userId: string, contactPhone: string): Promise<void> {
    await db.delete(conversationMessages)
      .where(and(eq(conversationMessages.userId, userId), eq(conversationMessages.contactPhone, contactPhone)))
  },

  async clearHistoryForChat(userId: string, contactPhone: string, jid: string): Promise<void> {
    // Șterge sub ambele formate posibile: contactPhone (din extractPhone) + numărul brut din JID
    const rawJidPrefix = jid.split('@')[0].split(':')[0]
    const toDelete = new Set([contactPhone, rawJidPrefix])
    for (const phone of toDelete) {
      await db.delete(conversationMessages)
        .where(and(eq(conversationMessages.userId, userId), eq(conversationMessages.contactPhone, phone)))
    }
  },

  async getContext(userId: string, contactPhone: string, limit = 20) {
    return db.select()
      .from(conversationMessages)
      .where(and(eq(conversationMessages.userId, userId), eq(conversationMessages.contactPhone, contactPhone)))
      .orderBy(desc(conversationMessages.waTimestamp))
      .limit(limit)
  },

  async getConversations(userId: string) {
    const result = await pool.query(`
      WITH ranked AS (
        SELECT
          contact_phone,
          body,
          wa_timestamp,
          from_me,
          ROW_NUMBER() OVER (PARTITION BY contact_phone ORDER BY wa_timestamp DESC) AS rn,
          COUNT(*) OVER (PARTITION BY contact_phone) AS total_count
        FROM conversation_messages
        WHERE user_id = $1
      )
      SELECT contact_phone, body AS last_message, wa_timestamp AS last_at, from_me, total_count::int AS count
      FROM ranked
      WHERE rn = 1
      ORDER BY wa_timestamp DESC
      LIMIT 200
    `, [userId])
    return result.rows.map((r: any) => ({
      contactPhone: r.contact_phone,
      lastMessage: r.last_message,
      lastAt: Number(r.last_at),
      fromMe: r.from_me,
      count: r.count,
    }))
  },

  async getMessagesForContact(userId: string, contactPhone: string) {
    const rows = await db.select()
      .from(conversationMessages)
      .where(and(eq(conversationMessages.userId, userId), eq(conversationMessages.contactPhone, contactPhone)))
      .orderBy(desc(conversationMessages.waTimestamp))
      .limit(50)
    return [...rows].reverse()
  },

  async getOwnerMessages(userId: string, limit = 60): Promise<string[]> {
    const rows = await db.select({ body: conversationMessages.body })
      .from(conversationMessages)
      .where(and(eq(conversationMessages.userId, userId), eq(conversationMessages.fromMe, true)))
      .orderBy(desc(conversationMessages.waTimestamp))
      .limit(limit)
    return rows.map(r => r.body)
  },

  async getContactMemory(userId: string, contactPhone: string): Promise<string | null> {
    const rows = await db.select()
      .from(contactMemory)
      .where(and(eq(contactMemory.userId, userId), eq(contactMemory.contactPhone, contactPhone)))
    return rows[0]?.summary ?? null
  },

  async upsertContactMemory(userId: string, contactPhone: string, summary: string): Promise<void> {
    const now = Date.now()
    const existing = await db.select({ id: contactMemory.id })
      .from(contactMemory)
      .where(and(eq(contactMemory.userId, userId), eq(contactMemory.contactPhone, contactPhone)))
    if (existing[0]) {
      await db.update(contactMemory)
        .set({ summary, updatedAt: now })
        .where(eq(contactMemory.id, existing[0].id))
    } else {
      await db.insert(contactMemory).values({
        id: randomUUID(), userId, contactPhone, summary, createdAt: now, updatedAt: now,
      })
    }
  },
}
