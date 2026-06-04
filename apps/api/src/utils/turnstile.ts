import { logger } from './logger.js'

// Verificare server-side a token-ului Cloudflare Turnstile (captcha invizibil). Frontend-ul produce
// un token, iar aici îl validăm la Cloudflare înainte de a crea contul.
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

interface SiteverifyResponse {
  success: boolean
  'error-codes'?: string[]
}

// Întoarce true DOAR dacă Cloudflare confirmă token-ul. FAIL-CLOSED: token lipsă, răspuns ne-ok sau
// eroare de rețea → false (respingem). Preferăm să blocăm o înregistrare decât să lăsăm un bot să
// treacă trimițând gunoi când verificarea pică. Cloudflare e oricum în fața întregului trafic.
export async function verifyTurnstile(secret: string, token: string | undefined, remoteip?: string): Promise<boolean> {
  if (!token || typeof token !== 'string') return false
  try {
    const form = new URLSearchParams()
    form.set('secret', secret)
    form.set('response', token)
    if (remoteip) form.set('remoteip', remoteip)

    const res = await fetch(VERIFY_URL, { method: 'POST', body: form })
    if (!res.ok) {
      logger.error('[turnstile] siteverify HTTP error', { status: res.status })
      return false
    }
    const data = (await res.json()) as SiteverifyResponse
    if (!data.success) {
      logger.warn('[turnstile] verification failed', { errors: data['error-codes'] })
    }
    return data.success === true
  } catch (err) {
    logger.error('[turnstile] siteverify request failed', { err: String(err) })
    return false
  }
}
