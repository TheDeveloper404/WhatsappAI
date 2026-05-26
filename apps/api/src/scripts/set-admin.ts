import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from '../config/database.js'
import { users } from '../db/schema.js'

const email = process.argv[2]
if (!email) {
  console.error('Usage: tsx src/scripts/set-admin.ts <email>')
  process.exit(1)
}

const result = await db.update(users)
  .set({ role: 'admin', updatedAt: Date.now() })
  .where(eq(users.email, email))

console.log(`✅ Role setat la 'admin' pentru ${email}`)
process.exit(0)
