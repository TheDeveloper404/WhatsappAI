import 'dotenv/config'
import '../config/env.js'
import { Pool } from 'pg'

console.log('[MIGRATE] DATABASE_URL:', process.env.DATABASE_URL ? `SET -> ${process.env.DATABASE_URL.slice(0, 40)}...` : 'NOT SET / UNDEFINED')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verify_token TEXT,
    email_verify_token_expiry BIGINT,
    reset_password_token TEXT,
    reset_password_token_expiry BIGINT,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    ip TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    plan TEXT CHECK(plan IN ('monthly','annual')),
    status TEXT NOT NULL DEFAULT 'trialing' CHECK(status IN ('trialing','active','past_due','canceled','incomplete')),
    trial_ends_at BIGINT,
    current_period_ends_at BIGINT,
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
  `CREATE TABLE IF NOT EXISTS ai_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    admin_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    timer_minutes INTEGER NOT NULL DEFAULT 5,
    system_prompt TEXT NOT NULL DEFAULT '',
    knowledge_base TEXT NOT NULL DEFAULT '',
    writing_style TEXT NOT NULL DEFAULT '',
    pause_until BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
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
    body TEXT NOT NULL,
    wa_timestamp BIGINT NOT NULL,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS platform_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read_at BIGINT,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS contact_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_phone TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE(user_id, contact_phone)
  )`,
  `CREATE TABLE IF NOT EXISTS whatsapp_auth_state (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_type TEXT NOT NULL,
    key_id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, key_type, key_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_conversation_messages_lookup ON conversation_messages(user_id, contact_phone, wa_timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, read_at)`,
]

for (const sql of statements) {
  await pool.query(sql)
}

console.log('Database migrated successfully.')
await pool.end()
