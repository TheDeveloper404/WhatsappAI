import { createRequire } from 'module'
import type { WASocket } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import NodeCache from 'node-cache'
import { whatsappRepository } from './whatsapp.repository.js'
import { usePostgresAuthState, clearAuthState } from './whatsapp.auth-state.js'
import { handleMessages } from '../ai/message.handler.js'
import { logger } from '../../utils/logger.js'

const _require = createRequire(import.meta.url)
const {
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = _require('@whiskeysockets/baileys') as any

const noop = () => {}
const waLogger: any = {
  level: 'warn',
  trace: noop, debug: noop, info: noop,
  warn:  (...a: any[]) => logger.warn('[WA]', { detail: a.join(' ') }),
  error: (...a: any[]) => {
    const errMsg = a[0]?.err?.message ?? ''
    if (errMsg === 'Timed Out') return
    if (errMsg === 'Invalid PreKey ID') return
    if (errMsg === 'No session record') return
    logger.error('[WA]', { detail: String(a[0]) })
  },
  fatal: (...a: any[]) => logger.error('[WA:fatal]', { detail: a.join(' ') }),
  child: () => waLogger,
}

const QR_TIMEOUT_MS = 60_000

const sessions = new Map<string, WASocket>()
const msgRetryCache = new NodeCache()
const reconnectAttempts = new Map<string, number>()
const MAX_RECONNECT_ATTEMPTS = 5

async function getBaileysVersion(): Promise<[number, number, number]> {
  try {
    const { version } = await fetchLatestBaileysVersion()
    return version
  } catch {
    return [2, 3000, 1015920]
  }
}

async function reconnectAfterDrop(userId: string): Promise<void> {
  if (sessions.has(userId)) return

  const attempts = (reconnectAttempts.get(userId) ?? 0) + 1
  if (attempts > MAX_RECONNECT_ATTEMPTS) {
    logger.warn(`[WA][${userId.slice(0, 8)}] prea multe reconectări, opresc`, { attempts })
    reconnectAttempts.delete(userId)
    await whatsappRepository.update(userId, { status: 'disconnected', pairingCode: null, pairingCodeExpiresAt: null, connectedAt: null })
    return
  }
  reconnectAttempts.set(userId, attempts)

  try {
    const { state, saveCreds } = await usePostgresAuthState(userId)
    const version = await getBaileysVersion()
    const sock: WASocket = makeWASocket({
      version,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, waLogger) },
      msgRetryCounterCache: msgRetryCache,
      printQRInTerminal: false,
      browser: ['WhatsApp AI', 'Chrome', '1.0.0'],
      logger: waLogger,
    })
    sessions.set(userId, sock)
    sock.ev.on('creds.update', saveCreds)
    attachPersistentHandlers(sock, userId)
    logger.info(`[WA][${userId.slice(0, 8)}] reconnectAfterDrop tentativa ${attempts}`)
  } catch (err) {
    logger.error(`[WA][${userId.slice(0, 8)}] reconnectAfterDrop eșuat`, { err: String(err) })
  }
}

function attachPersistentHandlers(sock: WASocket, userId: string) {
  sock.ev.on('connection.update', async (update: any) => {
    try {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        await whatsappRepository.update(userId, {
          status: 'pairing',
          pairingCode: qr,
          pairingCodeExpiresAt: Date.now() + 60_000,
        })
      }

      if (connection === 'close') {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode
        const shouldReconnect = reason !== DisconnectReason.loggedOut
        logger.info(`[WA][${userId.slice(0, 8)}] closed`, { reason, shouldReconnect })

        await whatsappRepository.update(userId, {
          status: 'disconnected',
          pairingCode: null,
          pairingCodeExpiresAt: null,
          connectedAt: null,
        })
        sessions.delete(userId)

        if (shouldReconnect) {
          setTimeout(() => reconnectAfterDrop(userId), 3000)
        }
      }

      if (connection === 'open') {
        reconnectAttempts.delete(userId)
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
          if (type !== 'notify') return
          await handleMessages(userId, sock, messages)
        })
        const phoneNumber = sock.user?.id?.split(':')[0] ?? null
        logger.info(`[WA][${userId.slice(0, 8)}] CONECTAT`, { phone: phoneNumber })
        await whatsappRepository.update(userId, {
          status: 'connected',
          phoneNumber,
          pairingCode: null,
          pairingCodeExpiresAt: null,
          connectedAt: Date.now(),
        })
      }
    } catch {
      // ignorăm erorile din event handler
    }
  })
}

export async function requestQrCode(userId: string): Promise<string> {
  const existing = sessions.get(userId)
  if (existing) {
    try { existing.end(undefined) } catch {}
    sessions.delete(userId)
  }

  // Șterge auth state vechi din DB — user-ul va scana QR nou
  await clearAuthState(userId)

  const { state, saveCreds } = await usePostgresAuthState(userId)
  const version = await getBaileysVersion()

  const sock: WASocket = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, waLogger) },
    msgRetryCounterCache: msgRetryCache,
    printQRInTerminal: false,
    browser: ['WhatsApp AI', 'Chrome', '1.0.0'],
    connectTimeoutMs: 20_000,
    logger: waLogger,
  })

  sessions.set(userId, sock)
  sock.ev.on('creds.update', saveCreds)

  logger.info(`[WA] socket creat pentru user ${userId.slice(0, 8)}`, { version })

  const firstQr = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout: WhatsApp nu a răspuns în 60 de secunde.'))
    }, QR_TIMEOUT_MS)

    sock.ev.on('connection.update', (update: any) => {
      const { qr, connection } = update
      if (connection === 'close') {
        clearTimeout(timer)
        reject(new Error('Conexiunea cu WhatsApp a fost închisă.'))
        return
      }
      if (qr) {
        clearTimeout(timer)
        resolve(qr)
      }
    })
  })

  attachPersistentHandlers(sock, userId)
  return firstQr
}

export async function disconnectSession(userId: string): Promise<void> {
  const sock = sessions.get(userId)
  if (sock) {
    try { sock.end(undefined) } catch {}
    sessions.delete(userId)
  }
  await clearAuthState(userId)
  await whatsappRepository.update(userId, {
    status: 'disconnected',
    pairingCode: null,
    pairingCodeExpiresAt: null,
    connectedAt: null,
  })
}

export function getActiveSocket(userId: string): WASocket | undefined {
  return sessions.get(userId)
}

export async function restoreAllSessions(): Promise<void> {
  const connected = await whatsappRepository.findAllConnected()
  logger.info(`[WA] restaurez ${connected.length} sesiuni la startup`)
  for (const session of connected) {
    await restoreSession(session.userId)
  }
}

export async function restoreSession(userId: string): Promise<void> {
  const session = await whatsappRepository.findByUserId(userId)
  if (!session || session.status !== 'connected') return
  if (sessions.has(userId)) return

  try {
    const { state, saveCreds } = await usePostgresAuthState(userId)
    const version = await getBaileysVersion()

    const sock: WASocket = makeWASocket({
      version,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, waLogger) },
      msgRetryCounterCache: msgRetryCache,
      printQRInTerminal: false,
      browser: ['WhatsApp AI', 'Chrome', '1.0.0'],
      logger: waLogger,
    })

    sessions.set(userId, sock)
    sock.ev.on('creds.update', saveCreds)
    attachPersistentHandlers(sock, userId)
  } catch (err) {
    logger.error(`[WA][${userId.slice(0, 8)}] restoreSession eșuat`, { err: String(err) })
  }
}
