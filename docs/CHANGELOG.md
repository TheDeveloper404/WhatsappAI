# Changelog — WhatsApp AI

Format bazat pe [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [0.8.0] — 2026-05-26

### Deployment — Railway (API) + Vercel (Frontend)

#### Railway API
- `Dockerfile` creat pentru build monorepo (`pnpm@9`, `apps/api`)
- `railway.json` configurat cu `DOCKERFILE` builder + `ON_FAILURE` restart policy
- Migrații mutate inline în `index.ts` cu **5 retry-uri** (3s delay) — Railway Hobby Postgres doarme la startup și cauzează `ETIMEDOUT` la prima tentativă
- Start command: `node apps/api/dist/index.js` (un singur proces, fără `&&`)
- Port: Railway auto-injectează `PORT=8080` → Networking configurat pe 8080
- API live: `https://api-production-2318d.up.railway.app`

#### Vercel Frontend
- Root Directory: `apps/web` (nu repo root)
- Singura variabilă necesară: `NEXT_PUBLIC_API_URL=https://api-production-2318d.up.railway.app`
- Vercel Analytics adăugat (`@vercel/analytics/next` în `layout.tsx`)
- Frontend live: `https://whatsapp-ai-web-rho.vercel.app`

#### Fix CORS cross-origin (Vercel → Railway)
- Cookie `refreshToken`: `sameSite: 'lax'` → `sameSite: 'none'`, `secure: true` (necesar cross-site)
- `clearCookie` la logout: adăugat `{ secure: true, sameSite: 'none' }`
- CORS origin: înlocuit string fix cu funcție care normalizează trailing slash din `APP_URL`
- `APP_URL` în Railway: `https://whatsapp-ai-web-rho.vercel.app`

### Known issues (post-lansare)
- **Resend**: emailurile merg doar la adresa contului Resend (sandbox). Necesită domeniu propriu verificat în Resend pentru utilizatori reali.
- **Stripe**: badge "Sandbox" apare dacă contul Stripe nu e complet activat/verificat pentru plăți live.

---

## [0.7.1] — 2026-05-26

### Fixed
- `DEFAULT_PROMPT` din `ai.repository.ts` — eliminat date personale reale (Liviu Băncilă, ACL Smart Software); înlocuit cu prompt generic neutru
- Timer save button (`settings/page.tsx`) — eliminat `timerMinutes === settings?.timerMinutes` din condiția `disabled`; Playwright `fill()` pe `input[type="number"]` nu declanșează React `onChange`
- Creat `whatsapp_ai_test` (vitest) și `whatsapp_ai_e2e` (Playwright) cu `ENCODING='UTF8'` — lipseau la migrarea pe PostgreSQL

### Infrastructure
- PostgreSQL pornit și configurat pe mașina de dev (Scoop, `C:\dev\apps\postgresql\18.4`)
- Rol `liviu` creat în PostgreSQL (superuser local, fără parolă)
- Toate cele 3 DB create și migrate cu UTF-8

---

## [0.7.0] — 2026-05-25

### Added — Faza 7: Landing Page
- Navbar flotant (floating pill) cu dark mode toggle și mobile menu
- Hero section cu headline mare, announcement chip animat, CTA-uri (signup + demo 90s), trust bar
- OperatorConsole — demo interactiv animat cu chat live, status agent, recent activity, stats grid
- Ticker — marquee cu activitate live (auto-scroll)
- HowItWorks — 3 pași (QR → Knowledge Base → Activare agent) cu carduri vizuale
- Features — 9 funcționalități în format tabel cu micro-vizuale inline
- Differentiator — secțiune personality cloning, side-by-side (scriere ta vs. agent, fingerprint 99% match)
- Pricing — 2 planuri (49.99 RON/lună, 399 RON/an), 7 zile trial, trust footer
- FAQ — 6 întrebări, acordion `details/summary` nativ
- Footer — logo, descriere, link-uri legale (termeni, confidențialitate, GDPR, cookies)
- `scrollToFooter` via sessionStorage (redirect corect din paginile legale)
- Dark mode complet cu persistare în localStorage

---

## [0.6.0] — 2026-05-24

### Added — Faza 6: AI Avansat
- RAG: memorie pe termen lung per contact (`contact_memory` table, extragere via Groq)
- Knowledge Base: câmp text în Settings, injectat în system prompt la fiecare răspuns
- Personality cloning: analiză automată stil scriere din ultimele 60 mesaje trimise (`POST /ai/analyze-style`)
- Transcriere mesaje vocale: Groq Whisper API, format OGG/PTT de la WhatsApp
- Detecție sentiment: keyword-based (urgent/frustrat), hint injectat în prompt
- Răspunsuri personalizate: `writingStyle` injectat în system prompt

### Security (audit complet)
- C1: Admin auth nu mai returnează `ADMIN_SECRET` în response body → `{ ok: true }`
- C2: `STRIPE_WEBHOOK_SECRET` devine required (nu mai e optional) — bypass semnătură eliminat
- H1: `accessToken` exclus din localStorage (Zustand persist) → doar în memorie
- H2: Rate limiting pe toate rutele auth (`/register`, `/login`, `/forgot-password`, `/reset-password`)
- H3: `emailVerifyToken` hashed HMAC-SHA256 în DB (consistent cu `resetPasswordToken`)
- H4: XSS escaping în emailurile custom trimise de admin (`escapeHtml()`)
- M1: `cleanOldLoginAttempts()` apelat la startup + periodic (1h interval)

### Migrated
- Backend migrat de la SQLite (`@libsql/client`) la **PostgreSQL** (`pg` + `drizzle-orm/node-postgres`)
- `global-setup.ts` și `setup.ts` actualizate pentru PostgreSQL
- `vitest.config.ts`: `DATABASE_URL=postgresql://localhost/whatsapp_ai_test`

### Tests
- 9 teste noi `detectSentiment()` → 156/156 API ✅
- E2E: 54/54 ✅ (re-verificat după Faza 6)

### Infrastructure fix (2026-05-25)
- Test DB `whatsapp_ai_test` recreat cu `ENCODING='UTF8'` — WIN1252 implicit Windows bloca INSERT cu diacritice românești (eroare PostgreSQL `22P05`)

---

## [0.5.0] — 2026-05-21

### Added — Faza 5: Admin Panel
- Dashboard admin cu stat cards (Total useri, Abonați, Agenți, MRR)
- Tab Useri: toggle agent, extindere trial, trimitere email, deconectare WA, ștergere cont
- Tab Activitate: feed notificări cronologic
- Tab Configurare: system prompt implicit pentru useri noi
- Notificări admin (bell icon, unread count, mark-read)
- `platform_config` table (key-value store setări platformă)
- Auto-dezactivare agent la `past_due`, `canceled`, `invoice.payment_failed`
- Notificări automate la: user nou, plată eșuată, subscription deleted

### Tests
- 63 teste noi API (admin + ai routes) → 136/136 ✅
- 11 teste noi webhook Stripe → 147/147 ✅
- E2E Playwright: 54/54 ✅

---

## [0.4.0] — 2026-05

### Added — Faza 4: AI Engine (Groq) + Inactivitate + Comenzi
- Integrare Groq API (Llama 3.3 70B)
- Timer inactivitate configurabil (1-60 min)
- Comenzi WhatsApp: `/activateAI`, `/deactivateAI`, `/pauseAI`, `/resumeAI`, `/setTimer`, `/skipAI`, `/unskipAI`, `/status`, `/help`, `/clearHistory`
- Blacklist contacte per user
- Context conversație (ultimele 20 mesaje)
- Pagina Settings: toggle AI + timer + system prompt + blacklist CRUD

### Tests
- Unit tests command parser: 18 teste
- Unit tests inactivity tracker: 8 teste
- WhatsApp integration: 7 teste → 72/72 ✅

---

## [0.3.0] — 2026-05

### Added — Faza 3: WhatsApp Baileys + QR
- Integrare `@whiskeysockets/baileys@6.17.16`
- Autentificare via QR code (pairing code abandonat — WhatsApp îl respingea silențios)
- `makeCacheableSignalKeyStore` pentru prevenire I/O race conditions pe signal keys
- Persistare sesiune Baileys pe disc, reconnect automat

---

## [0.2.0] — 2026-05

### Added — Faza 2: Stripe Subscriptions
- Subscripții lunar (49.99 RON) și anual (399 RON)
- Trial 7 zile la înregistrare
- Webhook handler: checkout, subscription updated/deleted, invoice payment_failed
- Pagina `/subscribe`, badge status în dashboard

---

## [0.1.0] — 2026-05

### Added — Faza 1: Auth + Monorepo
- Monorepo pnpm workspaces (`apps/api` + `apps/web`)
- Auth complet: register, verify-email, login, logout, forgot/reset password
- JWT: access token 15min + refresh token 7d httpOnly cookie cu rotație
- bcrypt cost 12, rate limiting login, no user enumeration
