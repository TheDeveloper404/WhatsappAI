import 'dotenv/config'
import { env } from './config/env.js'
import { OWNER_ID } from './config/owner.js'
import { Pool } from 'pg'
import { migrationStatements, ownerSeedStatement } from './db/migration-statements.js'

process.stdout.write('[BOOT] Starting, NODE_ENV=' + env.NODE_ENV + ' LLM_MODEL=' + env.LLM_MODEL + '\n')

// Migrare + seed owner, cu retry (Postgres poate porni după serviciu la boot-ul VPS-ului).
async function runMigrations() {
  const pool = new Pool({ connectionString: env.DATABASE_URL })
  try {
    for (const sql of migrationStatements) {
      await pool.query(sql)
    }
    await pool.query(ownerSeedStatement, [OWNER_ID, Date.now()])
  } finally {
    await pool.end().catch(() => {})
  }
}

for (let attempt = 1; attempt <= 10; attempt++) {
  try {
    await runMigrations()
    process.stdout.write('[BOOT] Migration OK\n')
    break
  } catch (err) {
    process.stdout.write('[BOOT] Migration failed (attempt ' + attempt + '): ' + String(err).split('\n')[0] + '\n')
    if (attempt === 10) {
      process.stdout.write('[BOOT] All migration attempts failed, exiting\n')
      process.exit(1)
    }
    await new Promise(r => setTimeout(r, 3000))
  }
}

const { isEncryptionConfigured } = await import('./utils/crypto.js')
const { startWhatsapp, stopWhatsapp } = await import('./modules/whatsapp/whatsapp.session-manager.js')
const { pool } = await import('./config/database.js')

if (!isEncryptionConfigured) {
  process.stdout.write('[BOOT] WARN: WHATSAPP_ENC_KEY nesetat — credențialele WhatsApp se stochează NECRIPTAT în Postgres.\n')
}

// Fără server HTTP: procesul trăiește prin socket-ul WhatsApp. Timer-ul ține event loop-ul viu și
// când socket-ul e oprit (ex. QR nescanat), ca serviciul să nu iasă și să intre în buclă de restart.
const keepAlive = setInterval(() => {}, 1 << 30)

async function shutdown(signal: string) {
  process.stdout.write('[BOOT] ' + signal + ' — opresc\n')
  clearInterval(keepAlive)
  stopWhatsapp()
  await pool.end().catch(() => {})
  process.exit(0)
}
process.on('SIGTERM', () => { void shutdown('SIGTERM') })
process.on('SIGINT', () => { void shutdown('SIGINT') })

startWhatsapp().catch(err => {
  process.stdout.write('[WA] start error: ' + String(err) + '\n')
  process.exit(1)
})
