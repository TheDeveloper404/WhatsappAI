import 'dotenv/config'
import { env } from './config/env.js'
import { Pool } from 'pg'
import { migrationStatements } from './db/migration-statements.js'

process.stdout.write('[BOOT] Starting, PORT=' + env.PORT + ' NODE_ENV=' + env.NODE_ENV + '\n')

// Migrare cu retry (Postgres pe Railway Hobby poate dormi la startup)
async function runMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  for (const sql of migrationStatements) {
    await pool.query(sql)
  }
  await pool.end().catch(() => {})
}

for (let attempt = 1; attempt <= 5; attempt++) {
  try {
    process.stdout.write('[BOOT] Migration attempt ' + attempt + '\n')
    await runMigrations()
    process.stdout.write('[BOOT] Migration OK\n')
    break
  } catch (err) {
    process.stdout.write('[BOOT] Migration failed: ' + String(err).split('\n')[0] + '\n')
    if (attempt === 5) {
      process.stdout.write('[BOOT] All migration attempts failed, exiting\n')
      process.exit(1)
    }
    await new Promise(r => setTimeout(r, 3000))
  }
}

const { buildApp } = await import('./app.js')
const { restoreAllSessions } = await import('./modules/whatsapp/whatsapp.session-manager.js')
const { authRepository } = await import('./modules/auth/auth.repository.js')

process.stdout.write('[BOOT] Modules loaded, starting server\n')

const app = await buildApp()
await app.listen({ port: env.PORT, host: '0.0.0.0' })

process.stdout.write('[BOOT] API running on port ' + env.PORT + '\n')

restoreAllSessions().catch(err => process.stdout.write('[WA] restore error: ' + String(err) + '\n'))
authRepository.cleanOldLoginAttempts().catch(() => {})
authRepository.deletePendingDeletionUsers().catch(() => {})
setInterval(() => authRepository.cleanOldLoginAttempts().catch(() => {}), 60 * 60 * 1000)
setInterval(() => authRepository.deletePendingDeletionUsers().catch(() => {}), 60 * 60 * 1000)
