import 'dotenv/config'
import './config/env.js'
import { env } from './config/env.js'
import { buildApp } from './app.js'
import { restoreAllSessions } from './modules/whatsapp/whatsapp.session-manager.js'
import { authRepository } from './modules/auth/auth.repository.js'

const app = await buildApp()

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`API running on http://localhost:${env.PORT}`)
  restoreAllSessions().catch(err => console.error('[WA] Eroare la restore startup:', err))
  authRepository.cleanOldLoginAttempts().catch(() => {})
  setInterval(() => authRepository.cleanOldLoginAttempts().catch(() => {}), 60 * 60 * 1000)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
