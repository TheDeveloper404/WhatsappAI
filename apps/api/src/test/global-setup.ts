import { Pool } from 'pg'

export async function setup() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost/whatsapp_ai_test',
  })

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
      deletion_scheduled_at BIGINT,
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
      cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
      cancel_at BIGINT,
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
      notify_on_ai_takeover BOOLEAN NOT NULL DEFAULT TRUE,
      lead_criteria TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'RON',
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
      is_ai BOOLEAN NOT NULL DEFAULT FALSE,
      body TEXT NOT NULL,
      wa_timestamp BIGINT NOT NULL,
      created_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS platform_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS admin_audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      target_user_id TEXT,
      metadata TEXT,
      ip TEXT,
      created_at BIGINT NOT NULL
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
    `CREATE TABLE IF NOT EXISTS stripe_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_bani INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      public_ref TEXT,
      contact_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')),
      total_bani INTEGER NOT NULL DEFAULT 0,
      customer_note TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT,
      product_name TEXT NOT NULL,
      unit_price_bani INTEGER NOT NULL,
      quantity INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS lead_insights (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'cold' CHECK(status IN ('hot','warm','cold')),
      score INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      UNIQUE(user_id, contact_phone)
    )`,
    `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mime TEXT NOT NULL,
      char_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ready',
      created_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS document_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding JSONB NOT NULL,
      created_at BIGINT NOT NULL
    )`,
    // ALTER idempotent pentru DB de test create înainte de aceste coloane — altfel
    // CREATE TABLE IF NOT EXISTS NU adaugă coloane la un tabel deja existent și ai
    // pica teste local pe coloane lipsă (deși în prod runStartupMigrations le adaugă).
    `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS lead_criteria TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'RON'`,
    `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS order_intake_prompt TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS details TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_estimate BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bookable BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS public_ref TEXT`,
    `CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      public_ref TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')),
      service_name TEXT NOT NULL,
      requested_slot TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    // whatsapp_auth_state: setup.ts face `DELETE FROM` el la fiecare beforeEach, deci TREBUIE să existe
    // chiar și pe un DB de test proaspăt (altfel toată suita pică la primul beforeEach).
    `CREATE TABLE IF NOT EXISTS whatsapp_auth_state (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key_type TEXT NOT NULL,
      key_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (user_id, key_type, key_id)
    )`,
    // M7 — coloana de ordonare a evenimentelor Stripe (folosită de webhook handler).
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_event_at BIGINT`,
    // L10 — refresh token reuse detection / family revocation (folosite de claim/save/revoke).
    `ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS family_id TEXT`,
    `ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS rotated_at BIGINT`,
  ]

  for (const sql of statements) {
    await pool.query(sql)
  }

  await pool.end()
}
