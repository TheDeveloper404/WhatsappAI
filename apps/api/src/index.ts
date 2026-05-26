import 'dotenv/config'

process.stdout.write('[INDEX] dotenv loaded\n')

let env: any
try {
  const envMod = await import('./config/env.js')
  env = envMod.env
  process.stdout.write('[INDEX] env OK PORT=' + env.PORT + ' NODE_ENV=' + env.NODE_ENV + '\n')
} catch (err) {
  process.stdout.write('[INDEX] env FAILED: ' + String(err) + '\n')
  process.exit(1)
}

let buildApp: any
try {
  const appMod = await import('./app.js')
  buildApp = appMod.buildApp
  process.stdout.write('[INDEX] app.js imported OK\n')
} catch (err) {
  process.stdout.write('[INDEX] app.js FAILED: ' + String(err) + '\n')
  process.exit(1)
}

let restoreAllSessions: any
try {
  const waMod = await import('./modules/whatsapp/whatsapp.session-manager.js')
  restoreAllSessions = waMod.restoreAllSessions
  process.stdout.write('[INDEX] session-manager imported OK\n')
} catch (err) {
  process.stdout.write('[INDEX] session-manager FAILED: ' + String(err) + '\n')
  process.exit(1)
}

let authRepository: any
try {
  const authMod = await import('./modules/auth/auth.repository.js')
  authRepository = authMod.authRepository
  process.stdout.write('[INDEX] auth.repository imported OK\n')
} catch (err) {
  process.stdout.write('[INDEX] auth.repository FAILED: ' + String(err) + '\n')
  process.exit(1)
}

let app: any
try {
  app = await buildApp()
  process.stdout.write('[INDEX] buildApp OK\n')
} catch (err) {
  process.stdout.write('[INDEX] buildApp FAILED: ' + String(err) + '\n')
  process.exit(1)
}

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  process.stdout.write('[INDEX] listening on port ' + env.PORT + '\n')
  restoreAllSessions().catch((err: any) => process.stdout.write('[WA] restore error: ' + String(err) + '\n'))
  authRepository.cleanOldLoginAttempts().catch(() => {})
  setInterval(() => authRepository.cleanOldLoginAttempts().catch(() => {}), 60 * 60 * 1000)
} catch (err) {
  process.stdout.write('[INDEX] listen FAILED: ' + String(err) + '\n')
  process.exit(1)
}
