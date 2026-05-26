# WhatsApp AI — Progress Checklist

---

## Comenzi Dev — Referință Rapidă

### Pornire servere (la fiecare sesiune de lucru)

```bash
# Terminal 1 — API (Fastify pe port 3001)
pnpm dev:api
# De ce: pornește serverul backend cu tsx watch (auto-reload la modificări)

# Terminal 2 — Frontend (Next.js pe port 3000)
pnpm dev:web
# De ce: pornește interfața web cu Fast Refresh

# Terminal 3 — Stripe webhooks (DOAR când lucrezi la billing/subscripții)
stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe
# De ce: forwardează evenimentele Stripe (plată, anulare) către serverul local
# ATENȚIE: fără --forward-to nu forwardează nimic — comandă greșită frecventă
```

### Baza de date

```bash
# Rulează migrările (creează tabelele noi, nu șterge date existente)
pnpm --filter api db:migrate
# Când: după fiecare fază care adaugă tabele noi în schema DB
```

> **IMPORTANT (Windows):** La prima instalare, creează toate DB cu UTF-8 explicit:
> ```sql
> CREATE DATABASE whatsapp_ai ENCODING='UTF8' LC_COLLATE='C' LC_CTYPE='C' TEMPLATE=template0;
> CREATE DATABASE whatsapp_ai_test ENCODING='UTF8' LC_COLLATE='C' LC_CTYPE='C' TEMPLATE=template0;
> CREATE DATABASE whatsapp_ai_e2e ENCODING='UTF8' LC_COLLATE='C' LC_CTYPE='C' TEMPLATE=template0;
> ```
> Pe Windows, PostgreSQL creează implicit cu encoding WIN1252 → diacriticele românești generează eroare `22P05`.

### Teste

```bash
# Rulează toate testele o dată
pnpm --filter api test

# Rulează testele în mod watch (se reexecută la modificări)
pnpm --filter api test:watch

# Rulează testele cu raport de acoperire
pnpm --filter api test:coverage
```

### Stripe CLI

```bash
# Autentificare (o singură dată, persistă)
stripe login

# Retrimite un eveniment Stripe deja procesat (util când serverul era oprit)
stripe events resend <event_id>
# Găsești event_id-ul în: stripe events list --limit=5

# Listează ultimele evenimente
stripe events list --limit=5
```

### Utilitare

```bash
# Oprește toate procesele node (dacă portul e ocupat / EADDRINUSE)
Get-Process node | Stop-Process -Force   # PowerShell
# Sau în terminal normal:
taskkill /F /IM node.exe

# Instalează dependențe după clone sau pull
pnpm install
```

### Ordine corectă la prima instalare (clone fresh)

```powershell
# 0. Pornește PostgreSQL (dacă nu e pornit)
& "C:\dev\apps\postgresql\18.4\bin\pg_ctl.exe" start -D "C:\dev\apps\postgresql\18.4\data" -w

# 1. Creează bazele de date (o singură dată pe mașina nouă)
# În psql -U postgres:
# CREATE DATABASE whatsapp_ai ENCODING='UTF8' LC_COLLATE='C' LC_CTYPE='C' TEMPLATE=template0;
# CREATE DATABASE whatsapp_ai_test ENCODING='UTF8' LC_COLLATE='C' LC_CTYPE='C' TEMPLATE=template0;
# CREATE DATABASE whatsapp_ai_e2e ENCODING='UTF8' LC_COLLATE='C' LC_CTYPE='C' TEMPLATE=template0;

pnpm install                        # 2. instalează toate dependențele
pnpm --filter api db:migrate        # 3. creează tabelele în whatsapp_ai (producție)
# Rulează manual și pentru celelalte DB dacă e nevoie (test + e2e)
pnpm dev:api                        # 4. pornește API
pnpm dev:web                        # 5. pornește frontend (terminal separat)
stripe listen --forward-to ...      # 6. webhooks Stripe (terminal separat, dacă lucrezi la billing)
```

---

## Faza 1 — Auth + Fundație Monorepo ✅ COMPLET

### Ce s-a construit
- [x] Monorepo pnpm workspaces (`apps/api` + `apps/web`)
- [x] Fastify API cu Clean Architecture (Controller → Service → Repository)
- [x] SQLite cu `@libsql/client` + Drizzle ORM
- [x] Schema DB: `users`, `refresh_tokens`, `login_attempts`
- [x] JWT custom (HMAC-SHA256), access 15min + refresh 7d cu rotație
- [x] `jti` unic per token (fix pentru bug: tokene identice în aceeași secundă)
- [x] bcrypt cost 12 pentru parole
- [x] Validare input cu Zod (server-side)
- [x] Rate limiting login (10 încercări / 15 min per IP)
- [x] Email de verificare cont (Resend)
- [x] Email de resetare parolă (Resend)
- [x] No user enumeration (forgot-password returnează mereu 200)
- [x] Next.js 14 App Router cu route groups `(auth)` și `(dashboard)`
- [x] Zustand cu persist middleware pentru auth state
- [x] Dashboard cu onboarding steps + stats grid
- [x] Tailwind CSS, paletă verde `#16A34A`

### Ce s-a testat
- [x] `password.ts` — hash, verify, salt unic (3 teste)
- [x] `tokens.ts` — create/verify access+refresh, tampering, expiry, hashToken, generateSecureToken (10 teste)
- [x] `POST /auth/register` — succes, email duplicat, parolă slabă, email invalid (4 teste)
- [x] `POST /auth/verify-email` — token valid, token invalid (2 teste)
- [x] `POST /auth/login` — succes, parolă greșită, email neverificat, email inexistent (4 teste)
- [x] `POST /auth/refresh` — succes, fără cookie, token reutilizat (rotation) (3 teste)
- [x] `POST /auth/logout` — șterge cookie (1 test)
- [x] `POST /auth/forgot-password` — mereu 200, email inexistent vs real (1 test)
- [x] `POST /auth/reset-password` — token valid, token invalid, parola veche invalidată (1 test)
- [x] `GET /users/me` — autentificat, fără token, token invalid (3 teste)
- **Total: 33/33 ✓**

### Ce NU s-a testat (lăsat intenționat)
- [ ] Frontend E2E (prea lent pentru MVP, UI se schimbă des)
- [ ] UI component tests (se schimbă des în faza asta)

---

## Faza 2 — Stripe Subscriptions ✅ COMPLET

- [x] Cont Stripe creat + chei API în `.env`
- [x] Webhook secret configurat (`whsec_...`) în `.env`
- [x] Schema DB: tabel `subscriptions`
- [x] Trial 7 zile la înregistrare (configurat în Stripe Checkout)
- [x] Planuri: 49.99 RON/lună și 399 RON/an
- [x] Pagina `/subscribe` cu card-uri de plan
- [x] `POST /api/v1/billing/checkout` → Stripe Checkout session
- [x] `POST /api/v1/billing/portal` → Stripe Customer Portal
- [x] `GET /api/v1/billing/subscription` → status curent
- [x] Webhook: `checkout.session.completed` → activare subscripție
- [x] Webhook: `customer.subscription.updated` → update status
- [x] Webhook: `customer.subscription.deleted` → status canceled
- [x] Webhook: `invoice.payment_failed` → status past_due
- [x] Redirect după login → `/subscribe` dacă nu are subscripție
- [x] Badge status subscripție în dashboard (Trial activ / Activ / Plată eșuată)
- [x] Badge „Trial X zile rămase" în dashboard
- [x] Fix: Zustand hydration — nu mai delogează la browser back
- [x] Fix: Stripe API v2026 — `current_period_end` → `billing_cycle_anchor`

### Ce s-a testat
- [x] `GET /billing/subscription` — 401 fără token, 200 returnează null
- [x] `POST /billing/checkout` — 401 fără token, 400 plan invalid, 200 monthly, 200 annual
- [x] `POST /billing/portal` — 401 fără token, 404 fără subscripție
- [x] Webhook handler — testat manual E2E (checkout → trialing în DB)
- **Total: 41/41 ✓**

### Ce NU s-a testat (lăsat intenționat)
- [ ] Webhook handler automat (logică testată manual E2E, Stripe gestionează securitatea)

### Decizii tehnice Faza 2
- Stripe CLI `--forward-to` pentru webhooks locale (nu uita să-l pornești în dev)
- `stripe listen` fără `--forward-to` nu forwardează nimic — comandă greșită frecventă
- Stripe API v2026-04-22.dahlia: `current_period_end` nu mai există pe Subscription root

---

## Faza 3 — WhatsApp Baileys + QR Code ✅ COMPLET

- [x] Instalare Baileys (`@whiskeysockets/baileys@6.17.16`)
- [x] Schema DB: tabel `whatsapp_sessions`
- [x] `whatsapp.session-manager.ts` — singleton Map<userId, WASocket>, connect/disconnect/restore
- [x] `whatsapp.repository.ts` — findByUserId, upsert, update, findAllConnected
- [x] `whatsapp.service.ts` — connect (generare QR), disconnect, getSession
- [x] `whatsapp.routes.ts` — GET /session, POST /connect, POST /disconnect
- [x] QR code flow — scanare cu WhatsApp app
- [x] Pagina `/connect` cu QRCodeSVG + polling status automat (3s) + refresh QR automat
- [x] Persistare sesiune Baileys pe disc (`data/sessions/{userId}/`)
- [x] Reconnect automat după drop (reconnectAfterDrop, max 5 tentative)
- [x] Restore sesiuni la startup API (restoreAllSessions în index.ts)
- [x] Dashboard: status WhatsApp live cu număr telefon, link „Conectează acum →" la pasul 3
- [x] Nav: link „WhatsApp" în bara de navigare
- [x] Migrare DB rulată cu succes

### Decizii tehnice Faza 3
- Baileys 6.17.16 este CJS-only → import via `createRequire(import.meta.url)`
- Pairing code abandonat — WhatsApp respingea companion_hello silențios fără eroare
- QR flow: `requestQrCode()` → Baileys emite `qr` → stocat în DB → frontend îl randează cu `qrcode.react`
- Post-scanare: WhatsApp trimite `isNewLogin: true` + stream error 515 (normal!) → `reconnectAfterDrop` după 3s → `connection: open`
- `makeCacheableSignalKeyStore` necesar pentru a evita race conditions pe signal keys
- Status polling din frontend (3s interval) — nu WebSocket, suficient pentru MVP
- Sesiunile persistate în `apps/api/data/sessions/{userId}/` (exclus din git)

---

## Faza 4 — AI Engine (Groq) + Inactivitate + Comenzi ✅ COMPLET

- [x] Cont Groq creat + GROQ_API_KEY în .env
- [x] Integrare Groq API (Llama 3.3 70B via fetch, fără SDK extra)
- [x] Timer inactivitate 5 min (configurabil) — agent răspunde doar dacă owner e offline
- [x] Parser comenzi WhatsApp: `/activateAI`, `/deactivateAI`, `/pauseAI Xh`, `/resumeAI`, `/setTimer Xmin`, `/skipAI`, `/unskipAI`, `/status`, `/help`
- [x] `/setTimer Xmin` — schimbă timer inactivitate din WhatsApp (1-60 min)
- [x] Comandă necunoscută sau fără parametru → răspuns automat cu hint `/help`
- [x] Blacklist contacte per user (DB + API routes)
- [x] Context conversație (ultimele 20 mesaje per contact)
- [x] Salvare mesaje în DB (`conversation_messages`) cu cleanup automat la 50/conversație
- [x] Răspuns confirmare comenzi direct în WhatsApp
- [x] Pending responses — când owner e activ, AI programează răspuns după expirare timer
- [x] Filtrare: nu răspunde la grupuri, răspunde la `@s.whatsapp.net` și `@lid`
- [x] REST API: GET/PATCH `/ai/settings`, GET/POST/DELETE `/ai/blacklist`
- [x] Pagina `/settings` — textarea system prompt + Save + lista comenzi WA
- [x] Nav: link „Setări" în bara de navigare

### Decizii tehnice Faza 4
- Model: `llama-3.3-70b-versatile`, max_tokens: 300, temperature: 0.9, frequency_penalty: 0.4, presence_penalty: 0.3
- Inactivity tracker în memorie (Map) — se resetează la restart API, acceptabil
- Comenzi interceptate din orice chat `fromMe: true` care începe cu `/`
- Reply la comenzi merge în același chat de unde a venit comanda
- `@lid` JID = linked device ID (WhatsApp nou privacy format) — tratat ca chat individual
- Mesaje context: ordonate crescător (oldest first) pentru Groq, role: user=contact, assistant=owner/AI

### Testat Faza 4
- [x] Unit tests command parser: 18 teste (inclusiv /setTimer, edge cases)
- [x] Unit tests inactivity tracker: 8 teste (cu vi.useFakeTimers)
- [x] WhatsApp integration tests actualizate la QR flow: 7 teste
- [x] **Total: 72/72 teste ✓**
- [x] `/activateAI`, `/deactivateAI`, `/pauseAI`, `/resumeAI`, `/status` — confirmate manual
- [x] `/setTimer 10` → timer schimbat, `/status` confirmă
- [x] AI răspunde la mesaje noi de la contacte (Groq generează răspuns relevant)
- [x] Context conversație menținut (7 mesaje consecutive)
- [x] Timer inactivitate (owner răspunde → AI tace, după expirare → AI trimite)
- [x] Settings page — system prompt se încarcă și salvează

### Ce NU are teste automate (acceptabil MVP)
- [ ] Integration tests pentru rutele `/ai/settings` și `/ai/blacklist` (CRUD simplu)
- [ ] `message.handler.ts` end-to-end (necesită mock Baileys + Groq)

---

## Faza 5 — Admin Panel (owner platformă) ✅ COMPLET

- [x] Panel separat la `/admin` — complet izolat de fluxul user, fără JWT user
- [x] **Bug fix:** `adminDisabled` flag în `ai_settings` — admin dezactivează definitiv, user nu poate bypass cu `/activateAI`
- [x] **Bug fix:** `/clearHistory` fără argument telefon — șterge istoricul conversației CURENTE (JID-ul din care trimiți comanda)
- [x] Stats extinse: MRR estimat, conversie trial→paid %, useri noi luna aceasta
- [x] Tabel useri: badge "Blocat admin" (portocaliu) când admin a dezactivat agentul
- [x] Acțiuni per user (dropdown): toggle agent, extinde trial, trimite email, deconectează WA, șterge cont
- [x] Modals: email (subiect + body), extinde trial (input zile), ștergere cont (confirmare)
- [x] Tabs: Useri | Activitate | Configurare
- [x] Tab Activitate: feed cronologic din tabelul notifications (color-coded per tip eveniment)
- [x] Tab Configurare: system prompt implicit pentru useri noi (editat și salvat din panel)
- [x] Tabela `platform_config` în DB (key-value store pentru setări platformă)
- [x] Route `GET/PATCH /admin/config` — citire/scriere configurare platformă
- [x] Route `POST /admin/users/:id/extend-trial` — prelungire trial cu X zile
- [x] Route `POST /admin/users/:id/disconnect-wa` — deconectare forțată sesiune WhatsApp
- [x] Route `DELETE /admin/users/:id` — ștergere cont complet (cascade)
- [x] Route `POST /admin/users/:id/email` — trimite email custom via Resend
- [x] Route `GET /admin/stats` — stats agregate (MRR, conversie, useri noi luna asta)
- [x] Autentificare admin cu `ADMIN_SECRET` din `.env` (cod secret) → token stocat în `sessionStorage`
- [x] Tabel `notifications` în DB (user_id FK, type, title, body, read_at, created_at)
- [x] `admin.repository.ts` — listUsers (JOIN subscriptions + WA session + AI settings), setAgentActive, CRUD notifications, getAdminUserId
- [x] `admin.routes.ts` — `POST /admin/auth`, `GET /admin/users`, `PATCH /admin/users/:id/agent`, `GET /admin/notifications`, `POST /admin/notifications/read`
- [x] `notifications.service.ts` — `notifyAdmin(type, title, body)` → salvare DB + email (fire-and-forget)
- [x] Auto-dezactivare agent la: `past_due`, `canceled`, `subscription.deleted`, `invoice.payment_failed` (webhooks Stripe)
- [x] Notificare admin la: user nou, plată eșuată, subscription deleted
- [x] Dashboard admin: 4 stat cards (Total useri, Abonați activi, În trial, Agenți activi)
- [x] Tabel useri: badge subscripție (trial/activ/past_due/canceled) + plan + zile rămase, badge WA (conectat/deconectat) + telefon, badge agent (activ/inactiv) + timer, dată înregistrare, buton toggle agent
- [x] Notification bell cu badge unread count, mark-read la deschidere
- [x] Light theme complet (bg-gray-50, bg-white, border-gray-200)
- [x] Script `set-admin.ts` — setează role 'admin' în DB pentru un email
- [x] UX forgot password: mesaj succes pe `/login?reset=1` după reset reușit
- [x] Mesaje eroare în română la login (email/parolă incorectă, prea multe încercări, email neverificat)
- [x] `/clearHistory <phone>` comandă WhatsApp — șterge istoricul conversației cu un contact

### Decizii tehnice Faza 5
- Admin auth e simplu: POST trimite ADMIN_SECRET → primește același token înapoi → verificare Bearer header
- Nu folosim JWT user pentru admin — panel complet independent, ADMIN_SECRET din `.env`
- Notificări stocate cu userId = ID-ul DB al adminului (lookup by ADMIN_EMAIL)
- Ruta `/admin` e în afara grupului `(dashboard)` — fără layout user, fără middleware subscripție

### Testat Faza 5
- [x] Login admin cu cod corect → dashboard
- [x] Login admin cu cod greșit → eroare "Cod incorect"
- [x] Toggle agent (activare/dezactivare) din dashboard
- [x] Bell notificări (unread count, mark-read)
- [x] Forgot password flow end-to-end (email trimis → link valid → parolă nouă → mesaj succes)
- [x] Mesaje eroare în română la login

### Teste automate adăugate post-Faza 5
- [x] `POST /admin/auth` — secret corect, greșit, lipsă (3 teste)
- [x] `GET /admin/users` — 401, token greșit, lista goală, include useri, câmpuri prezente (5 teste)
- [x] `GET /admin/stats` — 401, structură corectă, totalUsers crește (3 teste)
- [x] `PATCH /admin/users/:id/agent` — 401, dezactivare (2 teste)
- [x] `POST /admin/users/:id/extend-trial` — 401, zile=0, zile>365, valid (4 teste)
- [x] `DELETE /admin/users/:id` — 401, șterge+dispare din listă (2 teste)
- [x] `POST /admin/users/:id/email` — 401, subiect lipsă, body lipsă, valid, userId inexistent (5 teste)
- [x] `POST /admin/users/:id/disconnect-wa` — 401, ok chiar fără sesiune (2 teste)
- [x] `GET /admin/notifications` — 401, structură corectă (2 teste)
- [x] `POST /admin/notifications/read` — 401, marchează ca citite (2 teste)
- [x] `GET /admin/config` — 401, obiect gol inițial (2 teste)
- [x] `PATCH /admin/config` — 401, salvare+regăsire, suprascrie valoare (3 teste)
- [x] `GET /ai/settings` — 401, setări implicite auto-create, idempotent (3 teste)
- [x] `PATCH /ai/settings` — 401, activare, dezactivare, timer, validare min/max, prompt, prompt scurt, patch parțial (8 teste)
- [x] `GET /ai/blacklist` — 401, lista goală (2 teste)
- [x] `POST /ai/blacklist` — 401, adaugă valid, apare în GET, număr scurt, duplicat ignorat (5 teste)
- [x] `DELETE /ai/blacklist/:phone` — 401, șterge+dispare, număr inexistent (3 teste)
- [x] `GET /ai/conversations` — 401, lista goală (2 teste)
- [x] `GET /ai/conversations/:phone` — 401, array gol pentru contact fără mesaje (2 teste)
- [x] `DELETE /ai/conversations/:phone` — 401, 204 chiar fără mesaje (2 teste)
- **Total adăugat: 63 teste noi → 136/136 ✓**

### Teste webhook Stripe (adăugate ulterior)
- [x] `POST /webhooks/stripe` — lipsă signature header, semnătură invalidă, eveniment necunoscut (3 teste)
- [x] `checkout.session.completed` — actualizează subscripția, ignoră payment mode (2 teste)
- [x] `customer.subscription.updated` — past_due dezactivează agentul, active nu dezactivează, subscription inexistentă ignorată (3 teste)
- [x] `customer.subscription.deleted` — anulează + dezactivează agentul (1 test)
- [x] `invoice.payment_failed` — setează past_due + dezactivează agentul, customer inexistent ignorat (2 teste)
- **Total webhook: 11 teste noi → 147/147 ✓**

### Fix-uri adăugate post-Faza 5
- [x] `setup.ts` actualizat cu toate tabelele (ai_settings, contacts_blacklist, conversation_messages, platform_config, notifications)
- [x] `vitest.config.ts` — adăugat ADMIN_SECRET + ADMIN_EMAIL în env de test
- [x] `beforeEach` curăță și tabelele noi (prevenea contaminare între teste)
- [x] Bug fix: buton "Gestionează subscripția" — eroarea era înghițită silențios, acum arată mesaj utilizatorului

### Dashboard utilizator — funcționalități adăugate
- [x] Toggle AI direct din dashboard (fără WhatsApp commands)
- [x] Pagina Setări: toggle AI + timer (1-60 min) + system prompt + blacklist CRUD
- [x] Pagina Conversații (nouă): lista contactelor, thread expandabil, ștergere per contact
- [x] Navigație: link "Conversații" adăugat în navbar
- [x] API frontend: metode pentru blacklist CRUD + conversations (GET list, GET thread, DELETE)
- [x] Backend: `GET/GET/:phone/DELETE /ai/conversations` (3 rute noi)

---

## E2E Playwright Tests ✅ COMPLET (2026-05-26 — 54/54 confirmed)

- [x] 54/54 teste trec — admin, auth, dashboard, settings, connect, conversations
- [x] Infrastructură: `apps/e2e/` cu Playwright, helpers API, playwright.config.ts
- [x] Bază de date separată pentru teste: `postgresql://localhost/whatsapp_ai_e2e` (UTF-8)
- [x] Rute de test izolate: `/api/v1/test/*` (doar când `E2E_MODE=true`)

### Cum se rulează
```powershell
# Din apps/e2e/ — Playwright pornește API + web automat cu E2E_MODE=true
cd D:\production_mode\WhatsappAI\apps\e2e
pnpm exec playwright test
```

### Fix-uri aplicate
- `beforeEach`: `clearCookies()` + `localStorage.clear()` în toate fișierele (fix Zustand persist contamination)
- Selectors: `exact: true` și `getByRole` în loc de regex ambigue (fix strict mode violations)
- `confirmPassword` completat în toate formularele (signup, reset-password)
- `getResetToken`: endpoint `POST /create-reset-token` care generează raw token și stochează hash
- Crash 0ms: cauzat de servere pornite fără `E2E_MODE=true`

---

## Faza 6 — AI Avansat ✅ COMPLET (2026-05-24)

- [x] RAG — memorie pe termen lung per contact (`contact_memory` table, Groq extraction)
- [x] Knowledge Base — servicii și informații business (câmp text în Settings, injectat în system prompt)
- [x] Personality cloning — analiză automată stil scriere din ultimele 60 mesaje trimise
- [x] Transcriere mesaje vocale (Groq Whisper, format OGG/PTT)
- [x] Detecție sentiment (urgență, frustrare) — keyword-based, hint injectat în prompt
- [x] Răspunsuri personalizate pe baza stilului de scriere al owner-ului

### Testat Faza 6
- [x] `detectSentiment()` — 9 teste unitare (urgent, frustrated, normal, diacritice, `!!`, case-insensitive, prioritate)
- **Total adăugat: 9 teste → 156/156 ✓**

### Netestabil (acceptabil)
- `message.handler.ts` — necesită mock Baileys + Groq. Lăsat intenționat.
- `groq.client.ts` — utilizat doar din message.handler.ts, aceeași categorie.

### Fix-uri regresie (2026-05-24)
- [x] `setup.ts` — `ai_settings` actualizat cu `knowledge_base`, `writing_style`, `contact_memory` table
- [x] `app.ts` — `runStartupMigrations()` la buildApp() → E2E DB se actualizează la fiecare startup
- [x] `auth.service.ts` — mesaj verify-email tradus în română
- [x] `test.routes.ts` — `contact_memory` adăugat la resetDb
- [x] `auth.spec.ts` — locator specific pentru heading "Link invalid"
- [x] `settings.spec.ts` — `locator('textarea').first()` (3 textarea-uri după Faza 6)

---

## Faza 7 — Landing Page ✅ COMPLET

- [x] Navbar flotant (floating pill), responsive, dark mode toggle
- [x] Hero section — headline mare, announcement chip, 2 CTAs (signup + demo 90s), trust bar
- [x] OperatorConsole — demo interactiv animat (chat live, status, recent activity, stats grid)
- [x] Ticker — marquee cu activitate live
- [x] HowItWorks — 3 pași (QR → Knowledge Base → Activare agent) cu carduri vizuale
- [x] Features — 9 funcționalități în format tabel cu vizuale inline
- [x] Differentiator — secțiune personality cloning, side-by-side (scriere ta vs. agent, fingerprint 99% match)
- [x] Pricing — 2 planuri (49.99 RON/lună, 399 RON/an), 7 zile trial, trust footer
- [x] FAQ — 6 întrebări, acordion details/summary nativ
- [x] Footer — logo, descriere, link-uri legale (termeni, confidențialitate, GDPR, cookies)
- [x] `scrollToFooter` logic via sessionStorage (pentru redirect din pagini legale)
- [x] Dark mode complet (toggle + persistare în localStorage)

---

## Decizii tehnice importante (de nu uitat)

| Problemă | Soluție aleasă | De ce |
|----------|---------------|-------|
| `better-sqlite3` nu compilează pe Node 24 Windows | Migrat la **PostgreSQL** (`pg` + `drizzle-orm/node-postgres`) | Fără binare precompilate pentru SQLite pe Node 24 |
| `tsx watch` + `--env-file` incompatibil | `import 'dotenv/config'` prima linie | tsx tratează `watch` ca fișier |
| `next.config.ts` nu e suportat Next.js 14 | `next.config.mjs` | Limitare framework |
| Tokene JWT identice în aceeași secundă | `jti` unic (randomBytes) per token | HMAC e determinist |
| Email shared domain Resend | `onboarding@resend.dev` pentru dev | Domeniu propriu la scalare |
| PostgreSQL pe Windows creează DB cu WIN1252 | `ENCODING='UTF8' TEMPLATE=template0` la CREATE DATABASE | `DEFAULT_PROMPT` conține diacritice românești (UTF-8) incompatibile cu WIN1252 |
