import 'dotenv/config'
import { env } from './config/env.js'
import { OWNER_ID } from './config/owner.js'
import { Pool } from 'pg'
import { migrationStatements, ownerSeedStatement } from './db/migration-statements.js'

process.stdout.write('[BOOT] Starting, PORT=' + env.PORT + ' NODE_ENV=' + env.NODE_ENV + ' LLM_MODEL=' + env.LLM_MODEL + '\n')

// Migrare + seed owner, cu retry (containerul Postgres poate porni după API în docker compose).
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
    process.stdout.write('[BOOT] Migration attempt ' + attempt + '\n')
    await runMigrations()
    process.stdout.write('[BOOT] Migration OK\n')
    break
  } catch (err) {
    process.stdout.write('[BOOT] Migration failed: ' + String(err).split('\n')[0] + '\n')
    if (attempt === 10) {
      process.stdout.write('[BOOT] All migration attempts failed, exiting\n')
      process.exit(1)
    }
    await new Promise(r => setTimeout(r, 3000))
  }
}

const { buildApp } = await import('./app.js')
const { startWhatsapp } = await import('./modules/whatsapp/whatsapp.session-manager.js')

const app = await buildApp()
await app.listen({ port: env.PORT, host: '0.0.0.0' })

process.stdout.write('[BOOT] API running on port ' + env.PORT + '\n')

// Restaurează sesiunea salvată sau, dacă nu există, pornește asocierea (QR în loguri + dashboard).
startWhatsapp().catch(err => process.stdout.write('[WA] start error: ' + String(err) + '\n'))
