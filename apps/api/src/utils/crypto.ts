import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { env } from '../config/env.js'

// Criptare la rest a credențialelor de sesiune WhatsApp (H2). AES-256-GCM cu cheie dintr-un env
// dedicat (`WHATSAPP_ENC_KEY`), izolat de secretele de auth — un dump de DB/backup fără acces la
// env NU mai poate prelua sesiunile WhatsApp.
//
// Format self-describing:  enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
// Citirea tolerează plaintext-ul legacy (rânduri scrise înainte de criptare) → migrare
// transparentă: orice scriere ulterioară le re-salvează criptat.

const PREFIX = 'enc:v1:'

// Cheie de 32 bytes derivată determinist din env. SHA-256 acceptă orice input suficient de lung
// (hex / base64 / passphrase) și produce mereu fix 32 bytes pentru AES-256.
const key: Buffer | null = env.WHATSAPP_ENC_KEY
  ? createHash('sha256').update(env.WHATSAPP_ENC_KEY).digest()
  : null

export const isEncryptionConfigured = key !== null

export function encryptSecret(plaintext: string): string {
  // Fără cheie: stocăm ca înainte (vezi avertismentul de la pornire). Nu blocăm funcționarea.
  if (!key) return plaintext
  const iv = randomBytes(12) // nonce 96-bit, recomandat pentru GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`
}

export function decryptSecret(value: string): string {
  // Plaintext legacy (necriptat) → folosit ca atare.
  if (!value.startsWith(PREFIX)) return value
  if (!key) {
    // Date criptate dar cheia lipsește: nu decriptăm orbește — eroare clară, nu corupere silențioasă.
    throw new Error('WHATSAPP_ENC_KEY lipsește, dar există credențiale criptate. Setează cheia.')
  }
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Format de date criptate invalid.')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}
