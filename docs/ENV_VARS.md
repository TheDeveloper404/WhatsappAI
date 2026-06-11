# Variabile de Mediu — WhatsApp AI

Documentație completă pentru toate variabilele de mediu necesare.  
Creează un fișier `.env` în `apps/api/` și completează valorile.

---

## Template `.env`

```env
# ─── SERVER ───────────────────────────────────────────
NODE_ENV=development
PORT=3001

# ─── JWT ──────────────────────────────────────────────
# Minimum 32 caractere, random string
JWT_ACCESS_SECRET=SCHIMBA_CU_UN_STRING_RANDOM_MIN_32_CARACTERE
JWT_REFRESH_SECRET=SCHIMBA_CU_ALT_STRING_RANDOM_MIN_32_CARACTERE
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ─── DATABASE ─────────────────────────────────────────
# Development: PostgreSQL local
DATABASE_URL=postgresql://localhost/whatsapp_ai
# Producție: connection string de la Railway / Supabase / Neon
# DATABASE_URL=postgresql://user:password@host:5432/dbname

# ─── EMAIL (Resend) ───────────────────────────────────
RESEND_API_KEY=re_XXXXXXXXXXXXXXXXXXXXXXXXXXXX
EMAIL_FROM=noreply@domeniultau.com

# ─── URLs ─────────────────────────────────────────────
APP_URL=http://localhost:3000
API_URL=http://localhost:3001

# ─── STRIPE ───────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXX
STRIPE_PRICE_PRO_MONTHLY=price_XXXXXXXXXXXXXXXXXXXX  # tier Pro 79
STRIPE_PRICE_PRO_ANNUAL=price_XXXXXXXXXXXXXXXXXXXX   # tier Pro 790
STRIPE_PRICE_MAX_MONTHLY=price_XXXXXXXXXXXXXXXXXXXX  # tier Max 129
STRIPE_PRICE_MAX_ANNUAL=price_XXXXXXXXXXXXXXXXXXXX   # tier Max 1290
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXXXXXXXXXX

# ─── AI ───────────────────────────────────────────────
GROQ_API_KEY=gsk_XXXXXXXXXXXXXXXXXXXXXXXXXXXX
# Furnizor text: groq (default) sau gemini. Vocea rămâne mereu pe Groq.
# LLM_PROVIDER=gemini
# GEMINI_API_KEY=AIza_XXXXXXXXXXXXXXXXXXXXXXXX

# ─── ADMIN ────────────────────────────────────────────
ADMIN_EMAIL=admin@domeniultau.com
ADMIN_SECRET=SCHIMBA_CU_UN_STRING_RANDOM_MIN_32_CARACTERE
# 2FA (TOTP) la login admin — OPȚIONAL. Generează cu: tsx src/scripts/gen-admin-totp.ts
# Setat → /admin/auth cere și cod de 6 cifre; nesetat → 2FA sărit (dev/test). Setează în Railway.
# ADMIN_TOTP_SECRET=base32_generat_de_script

# ─── CRIPTARE CREDENȚIALE WHATSAPP (H2) ──────────────
# Generează: openssl rand -hex 32. Fără ea, sesiunile WhatsApp se stochează NECRIPTAT.
WHATSAPP_ENC_KEY=SCHIMBA_CU_openssl_rand_hex_32

# ─── CORS (opțional) ─────────────────────────────────
# Origini extra permise, separate prin virgulă (ex: Vercel preview URLs)
# CORS_ORIGINS=https://preview-xxx.vercel.app,https://alt-domeniu.com

# ─── E2E TESTING (nu seta în producție) ──────────────
# E2E_MODE=true
# E2E_SECRET=SCHIMBA_CU_UN_STRING_RANDOM_MIN_16_CARACTERE
```

---

## Descriere variabile

| Variabilă | Obligatorie | Descriere |
|---|---|---|
| `NODE_ENV` | Nu | `development` / `production` / `test`. Default: `development` |
| `PORT` | Nu | Portul API. Default: `3001` |
| `JWT_ACCESS_SECRET` | **Da** | Secret pentru semnarea access token-urilor. Min 32 chars |
| `JWT_REFRESH_SECRET` | **Da** | Secret pentru refresh tokens. Min 32 chars. **Diferit de ACCESS** |
| `JWT_ACCESS_EXPIRES_IN` | Nu | Expiry access token. Default: `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Nu | Expiry refresh token. Default: `7d` |
| `DATABASE_URL` | **Da** | Connection string PostgreSQL. Ex: `postgresql://localhost/whatsapp_ai` |
| `RESEND_API_KEY` | **Da** | API key de la [resend.com](https://resend.com) pentru trimitere email |
| `EMAIL_FROM` | **Da** | Adresa de la care se trimit emailurile. Trebuie verificată în Resend |
| `APP_URL` | **Da** | URL-ul aplicației web (ex: `https://app.domeniultau.com`) |
| `API_URL` | **Da** | URL-ul API-ului (ex: `https://api.domeniultau.com`) |
| `STRIPE_SECRET_KEY` | **Da** | Secret key din dashboard Stripe |
| `STRIPE_PRICE_PRO_MONTHLY` | **Da** | Price ID tier Pro lunar (79). Boot-ul eșuează dacă lipsește |
| `STRIPE_PRICE_PRO_ANNUAL` | **Da** | Price ID tier Pro anual (790) |
| `STRIPE_PRICE_MAX_MONTHLY` | **Da** | Price ID tier Max lunar (129) |
| `STRIPE_PRICE_MAX_ANNUAL` | **Da** | Price ID tier Max anual (1290) |
| `STRIPE_WEBHOOK_SECRET` | **Da** | Secret pentru validarea webhook-urilor Stripe. Serverul nu pornește fără el. |
| `GROQ_API_KEY` | **Da** | API key de la [console.groq.com](https://console.groq.com). Necesar mereu (LLM + transcriere vocală Whisper), chiar dacă `LLM_PROVIDER=gemini` |
| `GEMINI_API_KEY` | Nu | Cheie Google Gemini. Necesară doar dacă `LLM_PROVIDER=gemini` |
| `LLM_PROVIDER` | Nu | `groq` (default) sau `gemini` — furnizor pentru generarea de text. Vocea rămâne mereu pe Groq |
| `ADMIN_EMAIL` | Nu | Email-ul contului de admin |
| `ADMIN_SECRET` | Nu | Secret pentru autentificarea în panoul admin. Min 32 chars |
| `ADMIN_SESSION_SECRET` | Recomandat (dacă folosești admin) | Secret DEDICAT pentru semnarea sesiunii admin (M5), izolat de `JWT_ACCESS_SECRET`. `openssl rand -hex 32`. Fără el, sesiunea admin se derivă din JWT root (avertisment la pornire) |
| `ADMIN_TOTP_SECRET` | Recomandat (prod) | Secret TOTP (base32) pentru **2FA la login admin**. Generează cu `tsx src/scripts/gen-admin-totp.ts`. Setat → `/admin/auth` cere și cod de 6 cifre dintr-o aplicație authenticator; nesetat → 2FA sărit (dev/test/back-compat). Recovery: regenerează + actualizează în Railway |
| `WHATSAPP_ENC_KEY` | Recomandat | Cheie AES-256-GCM pentru criptarea la rest a credențialelor WhatsApp (H2). `openssl rand -hex 32`. Fără ea, creds-urile se stochează necriptat (avertisment la pornire) |
| `TRUST_PROXY_HOPS` | Nu | Nr. proxy-uri de încredere în fața app-ului pentru `req.ip` (M1, anti-spoofing XFF la rate-limit). Railway direct=`1`, prin Cloudflare=`2` (doar dacă blochezi accesul direct la `*.up.railway.app`). Default: `1`. NICIODATĂ `true` |
| `TRUST_CF_CONNECTING_IP` | Nu | `true` dacă API-ul e în spatele Cloudflare ȘI accesul direct la Railway e blocat → folosește `CF-Connecting-IP` pentru `req.ip` real. Doar împreună cu domeniul direct `*.up.railway.app` șters/blocat |
| `TURNSTILE_SECRET` | Nu | Secret server Cloudflare Turnstile (CAPTCHA la `/register`). Dacă e setat → register verifică token-ul (FAIL-CLOSED); dacă lipsește → verificarea e sărită (dev/test). Pereche cu `NEXT_PUBLIC_TURNSTILE_SITE_KEY` pe frontend |
| `CORS_ORIGINS` | Nu | Origini CORS extra, separate prin virgulă. Util pentru Vercel preview URLs |
| `E2E_MODE` | Nu | **Doar pentru teste E2E.** Activează endpoint-urile de test. NICIODATĂ în producție |
| `E2E_SECRET` | Nu | Header secret pentru rutele de test (`x-e2e-secret`). Min 16 chars |

---

## Cum generezi secrete sigure

```powershell
# PowerShell — generează un secret random de 64 caractere hex
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```

```bash
# Bash / Git Bash
openssl rand -hex 32
```

---

## Medii

| Mediu | Fișier | Note |
|---|---|---|
| Development local | `apps/api/.env` | Încărcat automat de cod. Valori sigure: `NODE_ENV=development`, DB locală, Stripe placeholder. Nu se commitează niciodată |
| Teste API (vitest) | `vitest.config.ts` (hardcodat) | `DATABASE_URL=postgresql://localhost/whatsapp_ai_test` |
| E2E Testing | Setate automat de Playwright | `E2E_MODE=true`, `DATABASE_URL=postgresql://localhost/whatsapp_ai_e2e` |
| Production | Railway env vars | Nu se folosesc fișiere `.env` |
| Backup producție | `apps/api/.env.production` | **DOAR referință** — NU este încărcat de cod. Ține valorile sincronizate cu Railway. Gitignored |

> ⚠️ **NICIODATĂ** nu commita `.env` sau `.env.production`. Ambele sunt în `.gitignore`.
>
> 🔒 `.env` (local) nu trebuie să conțină **niciun** secret de producție (fără `sk_live_`, fără DB Railway). Producția live trăiește exclusiv în Railway env vars.
>
> Setup DB și comenzi dev → vezi `DEV_SETUP.md`.
