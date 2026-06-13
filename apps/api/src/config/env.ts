import { z } from 'zod'

const envSchema = z.object({
  // Default FAIL-CLOSED: dacă NODE_ENV e nesetat (ex. uitat pe Railway), tratăm ca producție —
  // nu mai montăm rute de test și nu slăbim guard-urile (H5). Dev/E2E/test setează explicit.
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().default(3001),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  DATABASE_URL: z.string().default('./data/app.db'),

  RESEND_API_KEY: z.string(),
  EMAIL_FROM: z.string().email(),

  APP_URL: z.string().url(),
  API_URL: z.string().url(),

  STRIPE_SECRET_KEY: z.string().min(1),
  // Etapa 2.2a — price ID-uri pe tier (Pro 79/790, Max 129/1290). Required: misconfig pe billing
  // = fail-fast la boot, nu eroare tăcută la checkout. Creează-le în Stripe, pune-le în Railway.
  // (Vechile STRIPE_PRICE_MONTHLY/ANNUAL_ID au fost scoase — plan unic 49/399 retras, fără clienți de grandfather.)
  STRIPE_PRICE_PRO_MONTHLY: z.string().min(1),
  STRIPE_PRICE_PRO_ANNUAL: z.string().min(1),
  STRIPE_PRICE_MAX_MONTHLY: z.string().min(1),
  STRIPE_PRICE_MAX_ANNUAL: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),

  GROQ_API_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().optional(),
  // Furnizor pentru generarea de text. Transcrierea vocală rămâne mereu pe Groq (Whisper).
  LLM_PROVIDER: z.enum(['groq', 'gemini']).default('groq'),

  // Nr. de proxy-uri de încredere din fața app-ului (M1). `req.ip` se ia ca al (n+1)-lea din dreapta
  // în X-Forwarded-For → clientul nu mai poate falsifica IP-ul prepend-uind valori. NU folosi `true`
  // (ar avea încredere în orice → spoofing). Railway direct = 1 hop. Prin Cloudflare = 2 hops, DAR
  // setează 2 doar dacă blochezi accesul direct la *.up.railway.app (altfel redevine spoofabil pe
  // ruta directă). Default sigur: 1.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),

  // F1 (audit pentester): cheia de rate-limit pe `CF-Connecting-IP` în loc de `req.ip`. Activează
  // ('true') DOAR după ce API-ul e fronted de Cloudflare ȘI accesul direct la *.up.railway.app e
  // blocat — altfel header-ul e spoofabil pe ruta directă. Default off = comportament neschimbat.
  TRUST_CF_CONNECTING_IP: z.string().optional(),

  CORS_ORIGINS: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  // Lowercased la încărcare (F-OWN-01): emailurile userilor se stochează lowercased (schema register),
  // deci un `OWNER_EMAIL` cu majuscule ar rata silent match-ul de owner-bypass (fail-closed, dar footgun).
  OWNER_EMAIL: z.string().email().transform(v => v.toLowerCase()).optional(),
  ADMIN_SECRET: z.string().min(32).optional(),
  // Secret DEDICAT pentru semnarea sesiunii admin (M5). Dacă lipsește, se derivă din
  // JWT_ACCESS_SECRET (compatibilitate) — dar atunci un compromis al acelui secret permite și
  // forjarea sesiunilor admin. Setează-l separat în prod. Generează: openssl rand -hex 32.
  ADMIN_SESSION_SECRET: z.string().min(32).optional(),
  // Secret TOTP (base32) pentru 2FA la login-ul admin. Generează cu: tsx src/scripts/gen-admin-totp.ts.
  // OPȚIONAL: dacă lipsește, 2FA e sărit (dev/test/back-compat). Dacă e setat, POST /admin/auth cere
  // și un cod de 6 cifre dintr-o aplicație authenticator pe lângă ADMIN_SECRET. Setează-l în Railway.
  ADMIN_TOTP_SECRET: z.string().optional(),
  E2E_MODE: z.enum(['true', 'false']).optional(),
  E2E_SECRET: z.string().min(16).optional(),

  // Cheie pentru criptarea la rest a credențialelor de sesiune WhatsApp (H2). AES-256-GCM.
  // Generează: `openssl rand -hex 32`. Opțională ca să nu blocheze boot-ul, DAR fără ea creds-urile
  // WhatsApp se stochează necriptat (avertisment la pornire). Setează-o în Railway.
  WHATSAPP_ENC_KEY: z.string().min(32).optional(),

  // Cloudflare Turnstile (captcha invizibil anti-bot la înregistrare). Secret Key din widget-ul
  // Turnstile. Opțional ca să nu blocheze dev/test/E2E (unde nu trimitem token); când e SETAT,
  // `/auth/register` verifică token-ul la Cloudflare și respinge dacă lipsește/e invalid. Setează în prod.
  TURNSTILE_SECRET: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

// FAIL-FAST de siguranță (CRITICAL): `E2E_MODE=true` dezactivează rate-limit-urile (global + admin) și e
// gândit STRICT pentru E2E local. Setat din greșeală pe prod, ar slăbi tăcut apărarea anti brute-force.
// Combinația prod + E2E_MODE nu are nicio utilizare legitimă → oprim boot-ul vizibil în loc s-o tolerăm.
// (Rutele de test cer oricum `NODE_ENV !== 'production'`, deci nu se montează aici — dar throttling-ul ar dispărea.)
if (parsed.data.NODE_ENV === 'production' && parsed.data.E2E_MODE === 'true') {
  console.error('FATAL: E2E_MODE=true în producție (NODE_ENV=production). Slăbește guard-urile de securitate — refuz pornirea. Scoate E2E_MODE din env-ul de producție.')
  process.exit(1)
}

export const env = parsed.data
