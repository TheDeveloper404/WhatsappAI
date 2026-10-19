import { createRequire } from 'module'
import { randomUUID } from 'crypto'
import type { WASocket } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import NodeCache from 'node-cache'
import QRCode from 'qrcode'
import { whatsappRepository } from './whatsapp.repository.js'
import { usePostgresAuthState, clearAuthState } from './whatsapp.auth-state.js'
import { handleMessages } from '../ai/message.handler.js'
import { OWNER_ID } from '../../config/owner.js'
import { logger, maskPhone } from '../../utils/logger.js'

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
  warn:  noop,
  error: (...a: any[]) => {
    const first = a[0]
    const errMsg = first?.err?.message ?? first?.message ?? ''
    if (errMsg === 'Timed Out') return
    if (errMsg === 'Invalid PreKey ID') return
    if (errMsg === 'No session record') return
    if (errMsg.includes('SenderKey')) return
    const detail = first?.err?.message ?? first?.message ?? (typeof first === 'string' ? first : JSON.stringify(first))
    logger.error('[WA]', { detail })
  },
  fatal: (...a: any[]) => logger.error('[WA:fatal]', { detail: a.join(' ') }),
  child: () => waLogger,
}

const MAX_RECONNECT_ATTEMPTS = 5
const QR_TTL_MS = 60_000

// Stare unică (single-user). `sock` există și în timpul reconectării; `connected` doar după 'open'.
let sock: WASocket | null = null
let connected = false
let currentQr: { value: string; expiresAt: number } | null = null
let reconnectAttempts = 0
const msgRetryCache = new NodeCache()

async function getBaileysVersion(): Promise<[number, number, number]> {
  try {
    const { version } = await fetchLatestBaileysVersion()
    return version
  } catch {
    return [2, 3000, 1015920]
  }
}

async function ensureSessionRow(): Promise<void> {
  if (await whatsappRepository.findByUserId(OWNER_ID)) return
  const now = Date.now()
  await whatsappRepository.upsert({
    id: randomUUID(), userId: OWNER_ID, phoneNumber: null, status: 'disconnected',
    pairingCode: null, pairingCodeExpiresAt: null, connectedAt: null, createdAt: now, updatedAt: now,
  })
}

function printQrToTerminal(qr: string) {
  QRCode.toString(qr, { type: 'terminal', small: true })
    .then(ascii => process.stdout.write(`\n[WA] Scanează codul QR din WhatsApp → Dispozitive conectate → Conectează un dispozitiv:\n${ascii}\n`))
    .catch(() => {})
}

// Creează un socket cu starea de auth din Postgres. Fără creds înregistrate, Baileys emite QR.
async function createSocket(): Promise<void> {
  const { state, saveCreds } = await usePostgresAuthState(OWNER_ID)
  const version = await getBaileysVersion()
  const s: WASocket = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, waLogger) },
    msgRetryCounterCache: msgRetryCache,
    printQRInTerminal: false,
    browser: ['WhatsApp AI', 'Chrome', '1.0.0'],
    connectTimeoutMs: 20_000,
    logger: waLogger,
  })
  sock = s
  s.ev.on('creds.update', saveCreds)
  attachHandlers(s)
}

function attachHandlers(s: WASocket) {
  // `messages.upsert` legat o singură dată per socket (nu în handler-ul de 'open', care se poate re-emite).
  s.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    await handleMessages(OWNER_ID, s, messages)
  })

  s.ev.on('connection.update', async (update: any) => {
    // Un socket înlocuit (pairing nou / disconnect) nu mai are voie să modifice starea globală.
    if (s !== sock) return
    try {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        currentQr = { value: qr, expiresAt: Date.now() + QR_TTL_MS }
        printQrToTerminal(qr)
        await whatsappRepository.update(OWNER_ID, { status: 'pairing', pairingCode: null, pairingCodeExpiresAt: currentQr.expiresAt })
      }

      if (connection === 'open') {
        reconnectAttempts = 0
        connected = true
        currentQr = null
        const phoneNumber = s.user?.id?.split(':')[0] ?? null
        logger.info('[WA] CONECTAT', { phone: maskPhone(phoneNumber) })
        await whatsappRepository.update(OWNER_ID, {
          status: 'connected', phoneNumber, pairingCode: null, pairingCodeExpiresAt: null, connectedAt: Date.now(),
        })
      }

      if (connection === 'close') {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode
        connected = false
        currentQr = null
        sock = null
        await whatsappRepository.update(OWNER_ID, { status: 'disconnected', pairingCode: null, pairingCodeExpiresAt: null, connectedAt: null })

        if (reason === DisconnectReason.loggedOut) {
          // Dispozitivul a fost deconectat din telefon → creds-urile sunt moarte.
          logger.warn('[WA] delogat din telefon — reasociază din dashboard sau repornește serviciul')
          await clearAuthState(OWNER_ID)
          return
        }
        // 440 = sesiunea a fost preluată de altă instanță (ex. alt container pornit cu aceeași bază).
        if (reason === 440) {
          logger.warn('[WA] sesiune preluată de altă instanță — nu reconectez')
          return
        }

        reconnectAttempts++
        if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
          logger.warn('[WA] prea multe reconectări, opresc', { attempts: reconnectAttempts })
          reconnectAttempts = 0
          return
        }
        logger.info('[WA] conexiune închisă, reconectez', { reason, attempt: reconnectAttempts })
        setTimeout(() => {
          if (sock) return
          createSocket().catch(err => logger.error('[WA] reconectare eșuată', { err: String(err) }))
        }, 3000)
      }
    } catch (err) {
      logger.error('[WA] eroare connection.update', { err: String(err) })
    }
  })
}

// La pornire: reconectează cu creds-urile salvate sau, dacă nu există, emite QR de asociere.
export async function startWhatsapp(): Promise<void> {
  await ensureSessionRow()
  if (sock) return
  await createSocket()
}

// Asociere nouă: șterge creds-urile vechi și pornește un socket proaspăt (QR async, vezi getWhatsappState).
export async function startPairing(): Promise<void> {
  await ensureSessionRow()
  const old = sock
  sock = null
  connected = false
  currentQr = null
  reconnectAttempts = 0
  if (old) { try { old.end(undefined) } catch {} }
  await clearAuthState(OWNER_ID)
  await createSocket()
}

export async function disconnectSession(): Promise<void> {
  const old = sock
  sock = null
  connected = false
  currentQr = null
  if (old) {
    // logout() deconectează și dispozitivul din telefon; end() doar închide socket-ul local.
    try { await old.logout() } catch { try { old.end(undefined) } catch {} }
  }
  await clearAuthState(OWNER_ID)
  await whatsappRepository.update(OWNER_ID, { status: 'disconnected', pairingCode: null, pairingCodeExpiresAt: null, connectedAt: null })
}

export async function getWhatsappState(): Promise<{
  status: 'connected' | 'pairing' | 'connecting' | 'disconnected'
  phoneNumber: string | null
  connectedAt: number | null
  qrDataUrl: string | null
}> {
  const row = await whatsappRepository.findByUserId(OWNER_ID)
  const qrValid = currentQr && currentQr.expiresAt > Date.now()
  const status = connected ? 'connected' : qrValid ? 'pairing' : sock ? 'connecting' : 'disconnected'
  return {
    status,
    phoneNumber: row?.phoneNumber ?? null,
    connectedAt: connected ? (row?.connectedAt ?? null) : null,
    qrDataUrl: qrValid ? await QRCode.toDataURL(currentQr!.value, { margin: 1, width: 280 }) : null,
  }
}
