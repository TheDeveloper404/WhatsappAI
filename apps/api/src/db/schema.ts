import { pgTable, text, integer, boolean, bigint, jsonb, unique, primaryKey } from 'drizzle-orm/pg-core'

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
  // Ștergere cont cu confirmare pe email (double opt-in): token-ul (hash HMAC) + expiry.
  // Setate la cerere; ștergerea efectivă se face doar la confirmarea prin link.
  deletionToken: text('deletion_token'),
  deletionTokenExpiry: bigint('deletion_token_expiry', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})

export const refreshTokens = pgTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  // L10: lanțul unei autentificări (toate rotațiile succesive împart același familyId) +
  // momentul rotației (NULL = token activ; setat = rotat, păstrat pentru detecția de reuse).
  familyId: text('family_id'),
  rotatedAt: bigint('rotated_at', { mode: 'number' }),
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
  // Tier de valoare (Pro/Max). NULL = abonament legacy (49/399) → tratat ca Pro în cod (grandfathering).
  // Separat de `plan` (care e facturarea: monthly/annual). Vezi docs/SUBSCRIPTION_PLAN.md.
  tier: text('tier'),
  status: text('status').notNull().default('trialing'),
  trialEndsAt: bigint('trial_ends_at', { mode: 'number' }),
  currentPeriodEndsAt: bigint('current_period_ends_at', { mode: 'number' }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  cancelAt: bigint('cancel_at', { mode: 'number' }),
  // event.created (ms) al ultimului eveniment Stripe aplicat — ca să ignorăm evenimentele sosite
  // în dezordine (Stripe nu garantează ordinea). Vezi M7.
  lastEventAt: bigint('last_event_at', { mode: 'number' }),
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
  notifyOnAiTakeover: boolean('notify_on_ai_takeover').notNull().default(true),
  // Criterii (text liber, per-business): ce înseamnă un lead bun. Gol = clasificare generică.
  leadCriteria: text('lead_criteria').notNull().default(''),
  // Instrucțiuni colectare comandă (per-business): ce detalii cere agentul înainte de a propune
  // comanda (la optică: SPH/CYL/AX, material; la pizzerie: adresă). Gol = colectare generică.
  orderIntakePrompt: text('order_intake_prompt').notNull().default(''),
  // Moneda businessului (RON/EUR/USD/GBP). Banii rămân stocați ca integer subunitate; se schimbă doar eticheta.
  currency: text('currency').notNull().default('RON'),
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
  isAi: boolean('is_ai').notNull().default(false),
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

// Jurnal de audit pentru acțiunile admin (M5). Admin-ul nu e legat de identitate (secret partajat),
// deci reținem cel puțin acțiunea, ținta și IP-ul, pentru trasabilitate.
export const adminAuditLog = pgTable('admin_audit_log', {
  id: text('id').primaryKey(),
  action: text('action').notNull(),
  targetUserId: text('target_user_id'),
  metadata: text('metadata'),
  ip: text('ip'),
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

export const leadInsights = pgTable('lead_insights', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contactPhone: text('contact_phone').notNull(),
  // status: hot/warm/cold; score 0-100; reason = scurtă justificare a AI-ului
  status: text('status').notNull().default('cold'),
  score: integer('score').notNull().default(0),
  reason: text('reason').notNull().default(''),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, (t) => ({
  userContactUnique: unique().on(t.userId, t.contactPhone),
}))


export const products = pgTable('products', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  // Preț în bani (subunitate), NU lei. 49.99 lei => 4999. Niciodată float pentru bani.
  priceBani: integer('price_bani').notNull(),
  category: text('category').notNull().default(''),
  isAvailable: boolean('is_available').notNull().default(true),
  // Preț estimativ („începând de la"). TRUE = serviciu pe proiect custom (agenții, dezvoltare):
  // prețul afișat e doar un punct de pornire, finalul se stabilește după discuție. Pentru
  // aceste produse NU propunem total fix și NU înregistrăm comandă — rămânem în discovery și
  // predăm owner-ului pentru ofertă personalizată. FALSE = preț fix (model magazin).
  isEstimate: boolean('is_estimate').notNull().default(false),
  // Serviciu rezervabil (programare pe dată/oră). TRUE = frizerie/clinică/salon: clientul nu „comandă",
  // ci rezervă un interval. Agentul strânge serviciul + intervalul dorit + numele, creează o programare
  // 'pending' și predă owner-ului să confirme intervalul (handoff ușor, fără verificare de disponibilitate).
  isBookable: boolean('is_bookable').notNull().default(false),
  // Stoc numeric. NULL = nelimitat (servicii, producție la cerere). N = cantitate reală,
  // scade atomic la confirmarea comenzii de către client. 0 = epuizat (dar produsul există).
  stock: integer('stock'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Referință scurtă, prietenoasă, arătată clientului (ex. „ord_a1b2c3"). ID-ul intern (UUID)
  // rămâne pentru sistem; public_ref e fața lizibilă pe care o vede omul în conversație/dashboard.
  publicRef: text('public_ref').notNull(),
  contactPhone: text('contact_phone').notNull(),
  status: text('status').notNull().default('pending'),
  totalBani: integer('total_bani').notNull().default(0),
  customerNote: text('customer_note').notNull().default(''),
  // Detalii structurate colectate conversațional (text liber: specificații, cerințe custom).
  // Separat de customerNote — aici intră ce a cerut clientul dincolo de produs×cantitate.
  details: text('details').notNull().default(''),
  // Livrare (B11): metoda ('' necunoscut / 'pickup' ridicare / 'delivery' curier) + adresa structurată
  // (text liber, dar câmp dedicat ca owner-ul s-o copieze direct pentru AWB). Numele = customerNote,
  // telefonul = contactPhone.
  deliveryMethod: text('delivery_method').notNull().default(''),
  deliveryAddress: text('delivery_address').notNull().default(''),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})

export const orderItems = pgTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: text('product_id'),
  // Denormalizat: numele și prețul la momentul comenzii (produsul se poate schimba/șterge ulterior)
  productName: text('product_name').notNull(),
  unitPriceBani: integer('unit_price_bani').notNull(),
  quantity: integer('quantity').notNull(),
})

// Programări (N1): servicii rezervabile (frizerie, clinică, salon). Handoff ușor — agentul strânge
// serviciul + intervalul dorit (text liber) + numele, creează o programare 'pending' și anunță owner-ul,
// care confirmă manual intervalul. Fără calcul de sloturi/disponibilitate la acest nivel.
export const appointments = pgTable('appointments', {
  id: text('id').primaryKey(),
  // Referință scurtă lizibilă arătată în conversație/dashboard (ex. „prg_a1b2c3").
  publicRef: text('public_ref').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contactPhone: text('contact_phone').notNull(),
  status: text('status').notNull().default('pending'),
  // Serviciul cerut (denormalizat). La programări multi-serviciu (B10) e eticheta combinată
  // („Tuns + Aranjat barbă") pentru afișare rapidă; sursa structurată e în appointment_items.
  serviceName: text('service_name').notNull(),
  // Total preț (bani) al serviciilor programate. 0 = necunoscut/servicii fără preț.
  totalBani: integer('total_bani').notNull().default(0),
  // Intervalul dorit, ca text liber („vineri pe la 15"). Nu calculăm sloturi reale aici.
  requestedSlot: text('requested_slot').notNull().default(''),
  details: text('details').notNull().default(''),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})

// Liniile unei programări (B10): un serviciu rezervabil per rând, cu nume + preț denormalizate
// la momentul programării (serviciul se poate schimba/șterge ulterior).
export const appointmentItems = pgTable('appointment_items', {
  id: text('id').primaryKey(),
  appointmentId: text('appointment_id').notNull().references(() => appointments.id, { onDelete: 'cascade' }),
  productId: text('product_id'),
  serviceName: text('service_name').notNull(),
  unitPriceBani: integer('unit_price_bani').notNull().default(0),
})

// RAG — documente încărcate de owner ca bază de cunoștințe pentru agent.
export const documents = pgTable('documents', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mime: text('mime').notNull(),
  // Lungimea textului extras (caractere) — pentru afișare/diagnostic, NU stocăm fișierul brut.
  charCount: integer('char_count').notNull().default(0),
  // 'ready' = procesat și indexat; 'failed' = extragere/embedding eșuat.
  status: text('status').notNull().default('ready'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
})

// Bucățile (chunks) unui document + embedding-ul lor. Căutarea cosine se face în cod.
export const documentChunks = pgTable('document_chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  // Denormalizat pentru scoping/IDOR direct la retrieval, fără join pe documents.
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  // Vector embedding (Gemini text-embedding-004), stocat ca array de float.
  embedding: jsonb('embedding').$type<number[]>().notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
})

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type OrderItem = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert
export type Appointment = typeof appointments.$inferSelect
export type NewAppointment = typeof appointments.$inferInsert
export type AppointmentItem = typeof appointmentItems.$inferSelect
export type NewAppointmentItem = typeof appointmentItems.$inferInsert
export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
export type DocumentChunk = typeof documentChunks.$inferSelect
export type NewDocumentChunk = typeof documentChunks.$inferInsert

export type ContactMemory = typeof contactMemory.$inferSelect
export type LeadInsight = typeof leadInsights.$inferSelect

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
