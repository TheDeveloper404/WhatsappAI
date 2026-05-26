import 'dotenv/config'
import '../config/env.js'
import { Pool } from 'pg'
import { migrationStatements } from './migration-statements.js'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

for (const sql of migrationStatements) {
  await pool.query(sql)
}

console.log('Database migrated successfully.')
try { await pool.end() } catch {}
process.exit(0)
