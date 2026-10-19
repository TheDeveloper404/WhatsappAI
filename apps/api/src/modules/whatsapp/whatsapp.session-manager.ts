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

// Fără asociere (QR nescanat): ne oprim după câteva cicluri de QR ca să nu umplem logurile.
const MAX_PAIRING_ATTEMPTS = 5
// Cu sesiune asociată: reconectare la nesfârșit, cu backoff exponențial plafonat.
const MAX_BACKOFF_MS = 60_000

// Stare unică (single-user). `sock` există și în timpul reconectării.
let sock: WASocket | null = null
let paired = false
let attempts = 0
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

// Creează un socket cu starea de auth din Postgres. Fără creds asociate, Baileys emite QR.
async function createSocket(): Promise<void> {
  const { state, saveCreds } = await usePostgresAuthState(OWNER_ID)
  paired = Boolean(state.creds?.me)
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

function scheduleReconnect(delayMs: number) {
  setTimeout(() => {
    if (sock) return
    createSocket().catch(err => {
      logger.error('[WA] reconectare eșuată', { err: String(err) })
      scheduleReconnect(Math.min(delayMs * 2, MAX_BACKOFF_MS))
    })
  }, delayMs)
}

function attachHandlers(s: WASocket) {
  // `messages.upsert` legat o singură dată per socket (nu în handler-ul de 'open', care se poate re-emite).
  s.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    await handleMessages(OWNER_ID, s, messages)
  })

  s.ev.on('connection.update', async (update: any) => {
    if (s !== sock) return
    try {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        printQrToTerminal(qr)
        await whatsappRepository.update(OWNER_ID, { status: 'pairing', pairingCode: null, pairingCodeExpiresAt: null })
      }

      if (connection === 'open') {
        attempts = 0
        paired = true
        const phoneNumber = s.user?.id?.split(':')[0] ?? null
        logger.info('[WA] CONECTAT', { phone: maskPhone(phoneNumber) })
        await whatsappRepository.update(OWNER_ID, {
          status: 'connected', phoneNumber, pairingCode: null, pairingCodeExpiresAt: null, connectedAt: Date.now(),
        })
      }

      if (connection === 'close') {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode
        sock = null
        await whatsappRepository.update(OWNER_ID, { status: 'disconnected', pairingCode: null, pairingCodeExpiresAt: null, connectedAt: null })

        if (reason === DisconnectReason.loggedOut) {
          // Dispozitivul a fost deconectat din telefon → creds-urile sunt moarte.
          logger.warn('[WA] delogat din telefon — repornește serviciul pentru un QR nou')
          await clearAuthState(OWNER_ID)
          paired = false
          return
        }
        // 440 = sesiunea a fost preluată de altă instanță (aceeași bază, alt proces).
        if (reason === 440) {
          logger.warn('[WA] sesiune preluată de altă instanță — nu reconectez')
          return
        }

        attempts++
        if (!paired && attempts > MAX_PAIRING_ATTEMPTS) {
          logger.warn('[WA] QR nescanat — opresc. Repornește serviciul pentru un QR nou.')
          attempts = 0
          return
        }
        const delay = Math.min(3000 * 2 ** (attempts - 1), MAX_BACKOFF_MS)
        logger.info('[WA] conexiune închisă, reconectez', { reason, attempt: attempts, delayMs: delay })
        scheduleReconnect(delay)
      }
    } catch (err) {
      logger.error('[WA] eroare connection.update', { err: String(err) })
    }
  })
}

// La pornire: reconectează cu creds-urile salvate sau, dacă nu există, afișează QR în terminal/loguri.
export async function startWhatsapp(): Promise<void> {
  await ensureSessionRow()
  if (sock) return
  await createSocket()
}

// Închidere curată (SIGTERM de la systemd): închide socket-ul fără să delogheze dispozitivul.
export function stopWhatsapp(): void {
  const old = sock
  sock = null
  if (old) { try { old.end(undefined) } catch {} }
}
