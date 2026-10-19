// Source of truth pentru schema DB (raw SQL, idempotent). Rulat la fiecare pornire din index.ts
// (cu retry) și manual cu `pnpm --filter api db:migrate`.
//
// Compatibil cu o bază existentă din varianta SaaS: CREATE ... IF NOT EXISTS nu atinge tabelele
// existente, iar coloanele adăugate în timp au ALTER ... ADD COLUMN IF NOT EXISTS. Tabelele SaaS
// nefolosite (subscriptions, products, orders, ...) NU sunt șterse automat — vezi docs/DEPLOY_VPS.md.
export const migrationStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    phone_number TEXT,
    status TEXT NOT NULL DEFAULT 'disconnected' CHECK(status IN ('disconnected','pairing','connected')),
    pairing_code TEXT,
    pairing_code_expires_at BIGINT,
    connected_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
  // Starea de autentificare Baileys (creds + chei Signal), criptată cu WHATSAPP_ENC_KEY.
  `CREATE TABLE IF NOT EXISTS whatsapp_auth_state (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_type TEXT NOT NULL,
    key_id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, key_type, key_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ai_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    timer_minutes INTEGER NOT NULL DEFAULT 5,
    system_prompt TEXT NOT NULL DEFAULT '',
    knowledge_base TEXT NOT NULL DEFAULT '',
    writing_style TEXT NOT NULL DEFAULT '',
    notify_on_ai_takeover BOOLEAN NOT NULL DEFAULT TRUE,
    pause_until BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
  `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS knowledge_base TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS writing_style TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS notify_on_ai_takeover BOOLEAN NOT NULL DEFAULT TRUE`,
  `CREATE TABLE IF NOT EXISTS contacts_blacklist (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    UNIQUE(user_id, phone_number)
  )`,
  `CREATE TABLE IF NOT EXISTS conversation_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_phone TEXT NOT NULL,
    from_me BOOLEAN NOT NULL DEFAULT FALSE,
    is_ai BOOLEAN NOT NULL DEFAULT FALSE,
    body TEXT NOT NULL,
    wa_timestamp BIGINT NOT NULL,
    created_at BIGINT NOT NULL
  )`,
  `ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS is_ai BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS remote_jid TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_conversation_messages_lookup ON conversation_messages(user_id, contact_phone, wa_timestamp)`,
  `CREATE TABLE IF NOT EXISTS contact_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_phone TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE(user_id, contact_phone)
  )`,
  // Idempotență inbound: dedup pe (user, msg.key.id) — WhatsApp re-emite mesaje la reconectare.
  `CREATE TABLE IF NOT EXISTS processed_messages (
    user_id TEXT NOT NULL,
    id TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, id)
  )`,
]

// Seed pentru userul unic. INSERT ... WHERE NOT EXISTS (nu ON CONFLICT) ca să nu atingem un rând
// existent dintr-o bază SaaS veche. Pe o bază veche cu `users.email NOT NULL`, inserarea unui id NOU
// pică — atunci setează OWNER_USER_ID la id-ul userului existent (vezi docs/DEPLOY_VPS.md).
export const ownerSeedStatement = `
  INSERT INTO users (id, name, created_at, updated_at)
  SELECT $1, 'owner', $2, $2
  WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = $1)
`
