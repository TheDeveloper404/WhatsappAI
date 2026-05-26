import { pgTable, text, integer, boolean, bigint, unique, primaryKey } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  emailVerifyToken: text('email_verify_token'),
  emailVerifyTokenExpiry: bigint('email_verify_token_expiry', { mode: 'number' }),
  resetPasswordToken: text('reset_password_token'),
  resetPasswordTokenExpiry: bigint('reset_password_token_expiry', { mode: 'number' }),
  role: text('role').notNull().default('user'),
  deletionScheduledAt: bigint('deletion_scheduled_at', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})

export const refreshTokens = pgTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
})

export const loginAttempts = pgTable('login_attempts', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  ip: text('ip').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
})

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id').notNull().unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  plan: text('plan'),
  status: text('status').notNull().default('trialing'),
  trialEndsAt: bigint('trial_ends_at', { mode: 'number' }),
  currentPeriodEndsAt: bigint('current_period_ends_at', { mode: 'number' }),
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
  adminDisabled: boolean('admin_disabled').notNull().default(false),
  timerMinutes: integer('timer_minutes').notNull().default(5),
  systemPrompt: text('system_prompt').notNull().default('Ești o persoană reală care răspunde la WhatsApp. Scrii cald, relaxat, ca și cum ai cunoaște omul cu care vorbești.\n\nTonul tău:\n- Prietenos și direct, ca între oameni care se știu\n- Scurt: 1-2 propoziții maxim\n- Dacă cineva salută sau e vag, răspunzi cald și întrebi natural ce are nevoie: "Salut! Ce mai faci? Pot să te ajut cu ceva?" sau "Bună! Ce se întâmplă?"\n- Mereu folosești diacritice corecte: ă, â, î, ș, ț\n\nCe NU faci niciodată:\n- Nu ești AI, robot, asistent sau program — dacă ești întrebat, răspunzi scurt și dezinvolt: "Nu, de ce? 😄" sau "Cum adică robot? 😅" și continui conversația normal\n- NU folosești: "Desigur!", "Cu plăcere!", "Bineînțeles!", "Vreau să te ajut cu...", "Ca să răspund la întrebarea ta", "Pot să te ajut cu ceva legat de"\n- NU ești formal, rigid sau helpdesk\n- NU repeta aceleași structuri de la un mesaj la altul\n\nLimba: scrii în limba în care ți se scrie.'),
  knowledgeBase: text('knowledge_base').notNull().default(''),
  writingStyle: text('writing_style').notNull().default(''),
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
  fromMe: boolean('from_me').notNull().default(false),
  body: text('body').notNull(),
  waTimestamp: bigint('wa_timestamp', { mode: 'number' }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
})

export const platformConfig = pgTable('platform_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  readAt: bigint('read_at', { mode: 'number' }),
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


export type ContactMemory = typeof contactMemory.$inferSelect

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type RefreshToken = typeof refreshTokens.$inferSelect
export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
export type WhatsappSession = typeof whatsappSessions.$inferSelect
export type NewWhatsappSession = typeof whatsappSessions.$inferInsert
export type AiSettings = typeof aiSettings.$inferSelect
export type NewAiSettings = typeof aiSettings.$inferInsert
export type ContactBlacklist = typeof contactsBlacklist.$inferSelect
export type ConversationMessage = typeof conversationMessages.$inferSelect
export type PlatformConfig = typeof platformConfig.$inferSelect
export type Notification = typeof notifications.$inferSelect
