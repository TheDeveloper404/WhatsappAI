import { pgTable, text, integer, boolean, bigint, unique } from 'drizzle-orm/pg-core'

// Un singur rând (OWNER_ID), seed-uit la pornire. Păstrat doar ca țintă pentru FK-urile `user_id`.
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})

export const whatsappSessions = pgTable('whatsapp_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  phoneNumber: text('phone_number'),
  status: text('status').notNull().default('disconnected'),
  pairingCode: text('pairing_code'),
  pairingCodeExpiresAt: bigint('pairing_code_expires_at', { mode: 'number' }),
  connectedAt: bigint('connected_at', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})

export const aiSettings = pgTable('ai_settings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  isActive: boolean('is_active').notNull().default(false),
  timerMinutes: integer('timer_minutes').notNull().default(5),
  systemPrompt: text('system_prompt').notNull().default(''),
  // Knowledge base = text liber injectat în system prompt (setat cu /kb din WhatsApp).
  knowledgeBase: text('knowledge_base').notNull().default(''),
  writingStyle: text('writing_style').notNull().default(''),
  notifyOnAiTakeover: boolean('notify_on_ai_takeover').notNull().default(true),
  pauseUntil: bigint('pause_until', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})

export const contactsBlacklist = pgTable('contacts_blacklist', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  phoneNumber: text('phone_number').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, (t) => ({
  userPhoneUnique: unique().on(t.userId, t.phoneNumber),
}))

export const conversationMessages = pgTable('conversation_messages', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contactPhone: text('contact_phone').notNull(),
  // Jid WhatsApp real al contactului (`...@s.whatsapp.net` sau `...@lid`). NULL pe mesajele vechi.
  remoteJid: text('remote_jid'),
  fromMe: boolean('from_me').notNull().default(false),
  isAi: boolean('is_ai').notNull().default(false),
  body: text('body').notNull(),
  waTimestamp: bigint('wa_timestamp', { mode: 'number' }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
})

export const contactMemory = pgTable('contact_memory', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contactPhone: text('contact_phone').notNull(),
  summary: text('summary').notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, (t) => ({
  userContactUnique: unique().on(t.userId, t.contactPhone),
}))

// `whatsapp_auth_state` și `processed_messages` sunt accesate cu raw `pg` (vezi
// whatsapp.auth-state.ts / ai.repository.ts) — definite doar în migration-statements.ts.

export type WhatsappSession = typeof whatsappSessions.$inferSelect
export type NewWhatsappSession = typeof whatsappSessions.$inferInsert
export type AiSettings = typeof aiSettings.$inferSelect
export type NewAiSettings = typeof aiSettings.$inferInsert
export type ConversationMessage = typeof conversationMessages.$inferSelect
export type ContactMemory = typeof contactMemory.$inferSelect
