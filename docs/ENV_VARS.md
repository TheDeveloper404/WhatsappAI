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
STRIPE_PRICE_MONTHLY_ID=price_XXXXXXXXXXXXXXXXXXXX
STRIPE_PRICE_ANNUAL_ID=price_XXXXXXXXXXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXXXXXXXXXX

# ─── AI (Groq) ────────────────────────────────────────
GROQ_API_KEY=gsk_XXXXXXXXXXXXXXXXXXXXXXXXXXXX

# ─── ADMIN ────────────────────────────────────────────
ADMIN_EMAIL=admin@domeniultau.com
ADMIN_SECRET=SCHIMBA_CU_UN_STRING_RANDOM_MIN_32_CARACTERE

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
| `STRIPE_PRICE_MONTHLY_ID` | **Da** | ID-ul price-ului lunar din Stripe |
| `STRIPE_PRICE_ANNUAL_ID` | **Da** | ID-ul price-ului anual din Stripe |
| `STRIPE_WEBHOOK_SECRET` | **Da** | Secret pentru validarea webhook-urilor Stripe. Serverul nu pornește fără el. |
| `GROQ_API_KEY` | **Da** | API key de la [console.groq.com](https://console.groq.com) |
| `ADMIN_EMAIL` | Nu | Email-ul contului de admin |
| `ADMIN_SECRET` | Nu | Secret pentru autentificarea în panoul admin. Min 32 chars |
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
| Development | `apps/api/.env` | Nu se commitează niciodată |
| Teste API (vitest) | `vitest.config.ts` (hardcodat) | `DATABASE_URL=postgresql://localhost/whatsapp_ai_test` |
| E2E Testing | Setate automat de Playwright | `E2E_MODE=true`, `DATABASE_URL=postgresql://localhost/whatsapp_ai_e2e` |
| Production | Railway env vars | Nu se folosesc fișiere `.env` |

> ⚠️ **NICIODATĂ** nu commita fișierul `.env`. Este în `.gitignore`.
>
> Setup DB și comenzi dev → vezi `DEV_SETUP.md`.
