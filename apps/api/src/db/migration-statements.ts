export const migrationStatements = [
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
    deletion_token TEXT,
    deletion_token_expiry BIGINT,
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
  `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS knowledge_base TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS writing_style TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS is_ai BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS notify_on_ai_takeover BOOLEAN NOT NULL DEFAULT TRUE`,
  `CREATE INDEX IF NOT EXISTS idx_conversation_messages_ai ON conversation_messages(user_id, is_ai, created_at)`,
  // Refresh token reuse detection / family revocation (L10): family_id = lanțul unei autentificări;
  // rotated_at = momentul rotației (NULL = încă activ, păstrat după rotație pentru a detecta reuse).
  `ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS family_id TEXT`,
  `ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS rotated_at BIGINT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_token TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_token_expiry BIGINT`,
  `UPDATE refresh_tokens SET family_id = id WHERE family_id IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id)`,
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
  `CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id, is_available)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`,
  // Calificare lead-uri: criterii per-business + scor/status cache per contact
  `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS lead_criteria TEXT NOT NULL DEFAULT ''`,
  // Moneda businessului (catalog + comenzi)
  `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'RON'`,
  // Flux comenzi conversațional (Faza 2): instrucțiuni colectare + detalii structurate pe comandă
  `ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS order_intake_prompt TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS details TEXT NOT NULL DEFAULT ''`,
  // Stoc numeric per produs (NULL = nelimitat)
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER`,
  // Preț estimativ („începând de la"): servicii pe proiect custom. Default FALSE ⇒ produsele
  // existente (preț fix) rămân neschimbate. Pentru cele estimative nu propunem total fix / comandă.
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_estimate BOOLEAN NOT NULL DEFAULT FALSE`,
  // Serviciu rezervabil (programare): frizerie/clinică/salon. Default FALSE ⇒ produsele existente
  // rămân „comandabile". Pentru cele rezervabile, agentul face programare (handoff owner), nu comandă.
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bookable BOOLEAN NOT NULL DEFAULT FALSE`,
  // Programări (N1): handoff ușor — agentul strânge serviciul + intervalul dorit + numele și creează
  // o programare 'pending'; owner-ul confirmă intervalul. Fără calcul de sloturi/disponibilitate.
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
  `CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments(user_id, created_at)`,
  // Referință scurtă, prietenoasă, per comandă (ex. „ord_a1b2c3"). Coloana intră nullable ca
  // ALTER-ul să nu pice pe comenzile existente; backfill imediat le dă o referință, iar codul
  // de creare setează mereu una pentru comenzile noi.
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS public_ref TEXT`,
  `UPDATE orders SET public_ref = 'ord_' || substr(md5(random()::text), 1, 6) WHERE public_ref IS NULL`,
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
  `CREATE INDEX IF NOT EXISTS idx_lead_insights_user ON lead_insights(user_id, score)`,
  // RAG — documente bază de cunoștințe + chunks cu embedding (cosine în cod, fără pgvector)
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
  `CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_document_chunks_user ON document_chunks(user_id)`,
  // B11 — date de livrare structurate pe comandă (metodă + adresă), gata de copiat pentru AWB.
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT NOT NULL DEFAULT ''`,
  // B10 — programări cu mai multe servicii: total pe programare + tabel de linii (servicii).
  `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS total_bani INTEGER NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS appointment_items (
    id TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    product_id TEXT,
    service_name TEXT NOT NULL,
    unit_price_bani INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_appointment_items_appt ON appointment_items(appointment_id)`,
  // Etapa 2.2a — tier de abonament (Pro/Max). NULL = abonament legacy (49/399) tratat ca Pro
  // în cod (grandfathering). CHECK acceptă NULL în Postgres, deci nu strică rândurile existente.
  // `plan` rămâne facturarea (monthly/annual); `tier` e nivelul de valoare — dimensiuni separate.
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tier TEXT CHECK(tier IN ('pro','max'))`,
]
