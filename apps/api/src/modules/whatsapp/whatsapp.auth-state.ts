import { createRequire } from 'module'
import { pool } from '../../config/database.js'
import { encryptSecret, decryptSecret } from '../../utils/crypto.js'

const _require = createRequire(import.meta.url)
const { initAuthCreds, BufferJSON } = _require('@whiskeysockets/baileys') as any

export async function usePostgresAuthState(userId: string) {
  const credsRow = await pool.query(
    `SELECT data FROM whatsapp_auth_state WHERE user_id = $1 AND key_type = 'creds' AND key_id = 'main'`,
    [userId]
  )
  const creds = credsRow.rows[0]
    ? JSON.parse(decryptSecret(credsRow.rows[0].data), BufferJSON.reviver)
    : initAuthCreds()

  const saveCreds = async () => {
    await pool.query(
      `INSERT INTO whatsapp_auth_state (user_id, key_type, key_id, data, updated_at)
       VALUES ($1, 'creds', 'main', $2, $3)
       ON CONFLICT (user_id, key_type, key_id) DO UPDATE SET data = $2, updated_at = $3`,
      [userId, encryptSecret(JSON.stringify(creds, BufferJSON.replacer)), Date.now()]
    )
  }

  const keys = {
    get: async (type: string, ids: string[]) => {
      if (!ids.length) return {}
      const result = await pool.query(
        `SELECT key_id, data FROM whatsapp_auth_state
         WHERE user_id = $1 AND key_type = $2 AND key_id = ANY($3)`,
        [userId, type, ids]
      )
      const out: Record<string, any> = {}
      for (const row of result.rows) {
        out[row.key_id] = JSON.parse(decryptSecret(row.data), BufferJSON.reviver)
      }
      return out
    },

    set: async (data: Record<string, Record<string, any>>) => {
      const now = Date.now()
      for (const [type, typeKeys] of Object.entries(data)) {
        const toDelete = Object.entries(typeKeys).filter(([, v]) => v == null).map(([id]) => id)
        const toUpsert = Object.entries(typeKeys).filter(([, v]) => v != null)

        if (toDelete.length > 0) {
          await pool.query(
            `DELETE FROM whatsapp_auth_state WHERE user_id = $1 AND key_type = $2 AND key_id = ANY($3)`,
            [userId, type, toDelete]
          )
        }

        if (toUpsert.length > 0) {
          const params: any[] = [userId, now]
          const rows = toUpsert.map(([id, value], i) => {
            params.push(type, id, encryptSecret(JSON.stringify(value, BufferJSON.replacer)))
            const b = 3 + i * 3
            return `($1, $${b}, $${b + 1}, $${b + 2}, $2)`
          })
          await pool.query(
            `INSERT INTO whatsapp_auth_state (user_id, key_type, key_id, data, updated_at)
             VALUES ${rows.join(',')}
             ON CONFLICT (user_id, key_type, key_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
            params
          )
        }
      }
    },
  }

  return { state: { creds, keys }, saveCreds }
}

export async function clearAuthState(userId: string) {
  await pool.query(`DELETE FROM whatsapp_auth_state WHERE user_id = $1`, [userId])
}
