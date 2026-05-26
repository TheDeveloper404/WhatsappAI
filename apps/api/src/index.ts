import 'dotenv/config'
import './config/env.js'
import { env } from './config/env.js'
import { buildApp } from './app.js'
import { restoreAllSessions } from './modules/whatsapp/whatsapp.session-manager.js'
import { authRepository } from './modules/auth/auth.repository.js'

console.log('[INDEX] Starting, PORT:', env.PORT, 'NODE_ENV:', env.NODE_ENV)

let app: any
try {
  app = await buildApp()
} catch (err) {
  console.error('[INDEX] buildApp failed:', String(err))
  process.exit(1)
}

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`[INDEX] API running on port ${env.PORT}`)
  restoreAllSessions().catch(err => console.error('[WA] Eroare la restore startup:', err))
  authRepository.cleanOldLoginAttempts().catch(() => {})
  setInterval(() => authRepository.cleanOldLoginAttempts().catch(() => {}), 60 * 60 * 1000)
} catch (err) {
  console.error('[INDEX] listen failed:', String(err))
  process.exit(1)
}
