import 'dotenv/config'
import { Pool } from 'pg'
import { OWNER_ID } from '../config/owner.js'
import { migrationStatements, ownerSeedStatement } from './migration-statements.js'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

for (const sql of migrationStatements) {
  await pool.query(sql)
}
await pool.query(ownerSeedStatement, [OWNER_ID, Date.now()])

console.log('Database migrated successfully.')
try { await pool.end() } catch {}
process.exit(0)
