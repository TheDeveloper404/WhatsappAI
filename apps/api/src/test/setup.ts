import { beforeEach, afterAll } from 'vitest'
import { pool } from '../config/database.js'

beforeEach(async () => {
  await pool.query(`DELETE FROM whatsapp_auth_state`)
  await pool.query(`DELETE FROM notifications`)
  await pool.query(`DELETE FROM conversation_messages`)
  await pool.query(`DELETE FROM contacts_blacklist`)
  await pool.query(`DELETE FROM contact_memory`)
  await pool.query(`DELETE FROM ai_settings`)
  await pool.query(`DELETE FROM platform_config`)
  await pool.query(`DELETE FROM whatsapp_sessions`)
  await pool.query(`DELETE FROM subscriptions`)
  await pool.query(`DELETE FROM login_attempts`)
  await pool.query(`DELETE FROM refresh_tokens`)
  await pool.query(`DELETE FROM users`)
})

afterAll(async () => {
  await pool.end()
})
