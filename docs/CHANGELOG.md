# Changelog — WhatsApp AI

Format bazat pe [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added (2026-05-31) — Calificare lead-uri (backend, Faza 1-2)

- **Schema** — tabel nou `lead_insights` (userId, contactPhone, status `hot/warm/cold`, score 0-100, reason, timestamps; UNIQUE userId+contactPhone; index pe userId+score) + coloană `ai_settings.lead_criteria` (text liber: ce înseamnă un lead bun pentru acel business). Migrat în toate cele 4 locuri (`migration-statements.ts`, `schema.ts`, `app.ts` runStartupMigrations, `test/global-setup.ts` + cleanup în `test/setup.ts`).
- **Clasificare LLM** — `classifyLead(criteria, messages)` în `groq.client.ts`: apel Groq (temp 0) care întoarce JSON `{status, score, reason}`, **validat strict în cod** (status ∈ hot/warm/cold sau derivat din scor; scor plafonat 0-100; reason limitat). Doar clasifică, nu pune întrebări clientului. Criterii goale → ghid generic.
- **Repository/Service** — `getLeads` (toate contactele + scorul cached, LEFT JOIN, sortate pe scor), `upsertLeadInsight`, `getRecentContactPhones`; service `analyzeLead` (un contact) + `analyzeAllLeads` (lot plafonat la 40, fail-soft per contact).
- **Rute** — `GET /ai/leads` și `POST /ai/leads/analyze` (body opțional `{phone}` = un contact, fără body = lot). Ambele `authenticate`, scoped pe `req.user.id`; analyze are rate limit 5/min (cost LLM real). `lead_criteria` adăugat în schema `PATCH /ai/settings`.
- Scorarea e **la cerere** (din dashboard), nu automat la fiecare mesaj — cost LLM controlat.

### Added (2026-05-31) — Calificare lead-uri (UI, Faza 3)

- **Pagină nouă `/leads`** (`apps/web/src/app/(dashboard)/leads/page.tsx`) — listă contacte sortate pe scor, badge hot/warm/cold + scor + justificare AI, filtre pe status, buton „Recalculează scoruri" (lot) și „Recalculează" per contact. Stil consistent cu pagina Comenzi.
- **Navigare** — intrare „Lead-uri" (icon Flame) în sidebar + drawer mobil (`(dashboard)/layout.tsx`).
- **Settings** — câmp nou „Criterii calificare lead-uri" în tab-ul Conținut → `leadCriteria` (`settings/page.tsx`).
- **API client** (`lib/api.ts`) — tipuri `Lead`/`LeadStatus`/`LeadInsight`, `leadCriteria` în `AiSettings` + payload `updateSettings`, metode `api.ai.getLeads` / `api.ai.analyzeLeads`.
- Notă: la rezolvarea unei erori de build s-a descoperit că `settings/page.tsx` și `orders/page.tsx` aveau conținut duplicat (JSX repetat din editări anterioare de sesiune) — ambele rescrise curat. Build web verde, `tsc --noEmit` curat pe API + web.

### Added (2026-05-31) — Monedă per business (RON/EUR/USD/GBP)

- **Schema** — coloană `ai_settings.currency` (default `RON`), validată `z.enum(['RON','EUR','USD','GBP'])` în `PATCH /ai/settings`. Migrat în cele 4 locuri. **Banii rămân integer subunitate** — se schimbă doar eticheta afișată; **fără conversie valutară** (un business = o monedă, totalul rămâne coerent).
- **Helper partajat** `apps/web/src/lib/format.ts` — `formatAmount`, `currencyLabel`, `formatMoney`, `CURRENCIES`. Înlocuiește `formatLei` local duplicat din `orders` + `products`.
- **UI** — selector monedă în Setări → Agent; `orders` și `products` afișează moneda businessului (în loc de „lei” hardcodat); eticheta din formularul de preț e dinamică. Backend: mesajul de confirmare comandă, notificarea owner și catalogul injectat în prompt folosesc eticheta monedei (`message.handler.ts`).

### Fixed (2026-05-31) — Regresie settings + teste noi

- **Regresie reparată**: la rescrierea `settings/page.tsx` (Faza 3) se pierduseră funcționalități din original (toggle activare/dezactivare AI, „Analizează automat” stil, lista comenzi WhatsApp, avertismente admin/WA neconectat, salvări per-secțiune). Pagina a fost restaurată complet, cu currency + leadCriteria adăugate peste structura originală.
- **Teste noi** (le rulează userul): `lead.parser.test.ts` (12 teste pe validarea strictă a JSON-ului LLM din `parseLeadClassification` — extrasă ca funcție pură) + extinderi în `ai.integration.test.ts` (currency default/set/enum-invalid, leadCriteria, `GET /ai/leads` gol, `POST /ai/leads/analyze` lot gol fără apel LLM + phone invalid).
- **Setup test reparat**: `global-setup.ts` adaugă `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pentru `lead_criteria` + `currency` — altfel pe o DB de test creată înainte de aceste coloane, `CREATE TABLE IF NOT EXISTS` NU le-ar fi adăugat și ai fi avut teste picate local care în prod ar fi fost OK.

### Fixed (2026-05-31)

- **Comenzi duplicate + răspuns robotic repetat** — `extractOrder` primea tot istoricul conversației, deci la FIECARE mesaj ulterior re-extrăgea aceeași comandă → crea o comandă nouă în DB și retrimitea identic „Am notat comanda ta… Îți confirmăm în scurt timp" (vizibil în prod: zeci de comenzi „2× Pizza Diavola" identice + conversație unde AI-ul nu răspundea la „în cât timp se livrează?"). Fix în `message.handler.ts` → `sendAiResponse`: înainte de a crea comanda, se calculează o semnătură `productId×qty` și se compară cu comenzile recente ale contactului (`ordersRepository.listRecentForContact`, fereastră 12h, exclude `cancelled`). Dacă există deja o comandă identică, NU se mai creează una nouă și NU se retrimite confirmarea — se injectează contextul comenzii active în system prompt (`[Comandă activă a clientului]`) și AI-ul răspunde firesc la mesajul curent (livrare, modificări, confirmare).
- **Ștergere comenzi** — owner-ul poate șterge o comandă din `/orders` (buton coș per rând, cu confirmare). Backend: `DELETE /api/v1/orders/:id` (`orders.routes.ts`) + `ordersRepository.delete` (liniile cad prin `ON DELETE CASCADE`); client: `api.orders.remove` + `handleDelete` în `orders/page.tsx`.

### Changed (2026-05-31)

- **Lățime unificată dashboard** — toate paginile din dashboard au acum aceeași lățime (`max-w-6xl`), centralizată în `layout.tsx` (sursă unică). Înainte fiecare pagină avea alt `max-w` (2xl–5xl) → arătau inconsistent și prea înguste pe centru. Eliminat `max-w` per-pagină din dashboard/orders/products/settings/profile/connect/conversations.
- **Catalog mobile** — header (titlu + butoane) trece pe rânduri separate pe mobil; rândul de produs afișează prețul sub nume pe ecrane mici (nu mai e înghesuit lângă butoane).

### Added (2026-05-30)

- **Metrici avansate (Performanță agent)** — secțiune nouă în dashboard: conversații preluate de AI, rată de rezolvare fără intervenție (`takeoverRate`), conversații escaladate către owner, grafic cu bare pe ultimele 7 zile. Toate derivate din `conversation_messages` (fără tabele noi) — `getAdvancedStats` în `ai.repository.ts`, rută `GET /ai/stats/advanced`. Escaladare = owner a scris manual după ce AI răspunsese; rezolvare = AI a închis fără intervenție ulterioară.
- **Navigare hamburger consistentă** — înlocuit sidebar-ul fix (desktop) + bottom nav (mobile, devenise înghesuit cu 6 itemi) cu un singur pattern: top bar cu buton hamburger → drawer lateral, identic pe desktop și mobile. Închidere la click link / overlay / ESC, blocare scroll body cât e deschis.
- **Fix zoom iOS** — `globals.css`: font minim 16px pe `input/textarea/select` sub 640px, oprește auto-zoom-ul Safari la focus pe câmpuri (afecta settings/products/orders cu `text-[13px]`).
- **Popup expirare trial** — pe dashboard apare un popup la ≤3 zile rămase din trial (status `trialing`, necancelat), dismissibil o dată pe zi per browser (localStorage). Înlocuiește ideea de email reminder.
- **Import CSV catalog** — owner-ul încarcă un CSV cu produse în `/products` (parsat în browser, fără dependențe noi: `lib/csv.ts`). Coloane flexibile RO/EN (`nume`/`name`, `pret`/`price`, opțional `categorie`/`descriere`/`disponibil`), auto-detect separator `,`/`;`, suport ghilimele + BOM Excel. Preview cu validare per-rând înainte de confirmare; endpoint bulk `POST /products/import` (max 1000 rânduri). Produsele se adaugă la cele existente. System prompt-ul rămâne separat (pentru întrebări casual de preț).
- **Comenzi prin WhatsApp** — catalog de produse per user (`products`) + comenzi (`orders`, `order_items`). Owner gestionează catalogul din `/products` și comenzile din `/orders` (listă, filtre pe status, schimbare status pending→confirmed→completed→cancelled). AI-ul extrage comenzi din conversație (`extractOrder`, Groq/Gemini, temp 0, JSON validat strict), creează comanda în DB (`pending`), confirmă clientului cu total și notifică owner-ul pe WhatsApp. **Prețurile/totalul se calculează în cod din DB, niciodată de LLM** (protecție prompt injection). Catalogul disponibil se injectează și în prompt-ul normal pentru oferte corecte.
- **Switch furnizor LLM** — `LLM_PROVIDER` env (`groq` default / `gemini`). Dispatcher în `groq.client.ts` (`callGroq`) rutează generarea de text; Gemini 2.0 Flash via `callGeminiApi`. Transcrierea vocală rămâne mereu pe Groq Whisper. Fail-safe: dacă `gemini` selectat fără cheie, cade pe Groq.
- **Gatekeeper LLM business-only** — userii reali au reușit să scoată AI-ul din scop (bancuri, rețete) pentru că guard-ul keyword (`classifyBusinessScope`) prinde doar formulări exacte. Adăugat strat secundar `classifyScopeLLM` (`groq.client.ts`): apel Groq scurt (temp 0, max 10 tokens) care clasifică ultimul mesaj `BUSINESS`/`OFF_TOPIC`/`INJECTION` când keyword-urile au lăsat să treacă. Fail-open la eroare Groq (nu blocăm clienți reali). Mesajele blocate se loghează cu `scope` (`message.handler.ts`).

### Fixed (code review 2026-05-30)

- **CR-S3** — Statistici AI calculate pe ora României (`Europe/Bucharest`, cu DST) în loc de UTC; „luna" e acum luna calendaristică curentă, nu ultimele 30 de zile rolling (`ai.repository.ts` → `getStats` + helperii `startOfDayInTz`/`startOfMonthInTz`)
- **CR-S4** — Dashboard: cardul Trial afișează `Mesaje AI (30z)` din `stats.month`, înlocuit placeholder-ul hardcodat `—` (`dashboard/page.tsx`)
- **CR-S5** — `extractContactMemory` throttled la max o dată / 10 min per contact — elimină apelul Groq suplimentar la fiecare răspuns AI (`message.handler.ts`)
- **CR-S7** — Rate limit `30/min` adăugat pe `GET /ai/stream` (SSE)
- **CR-S8** — Curățenia „ultimele 50 mesaje" rulează probabilistic (~10%), nu la fiecare INSERT — un query DB în minus per mesaj (`ai.repository.ts` → `saveMessage`)
- **CR-S9** — Guard prompt-injection prinde acum obfuscarea cu separatori (`i-g-n-o-r-a`, `i g n o r a`) prin comparație pe versiune compactă (`message.handler.ts` → `classifyBusinessScope`)
- **CR-S10** — Deduplicare webhook Stripe: tabel nou `stripe_events`; evenimentele deja procesate se confirmă cu `200` fără re-rulare (protecție la at-least-once delivery) (`stripe.webhook.ts`). Dedup-ul rulează doar dacă `event.id` există — fără cheie sărim peste (un event Stripe real are mereu id; evităm 500 + retry inutil).
- **CR-S13** — `global-setup.ts` (setup teste) actualizat cu tabelul `stripe_events` — lipsea, cauza celor 10 teste de webhook picate local (prod nu era afectat, migrarea rulează din `migration-statements.ts`). Notă: schema e dublicată în 3 locuri (`migration-statements.ts` / `app.ts` / `global-setup.ts`) — candidat de refactor pentru a importa dintr-o singură sursă.

### Removed

- **CR-S11** — Eliminat debug `process.stdout.write('[ENV]...')` din `env.ts` (2 linii)
- **CR-S12** — Șters `gemini.client.ts` (cod mort, neimportat) + scos `GEMINI_API_KEY` din schema env

---

## [0.9.0] — 2026-05-27

### Security

- **SEC-005** — PII eliminat din logurile de producție: numere de telefon și preview-uri de mesaje nu mai apar în logs
- **SEC-007** — GDPR: ștergere cont self-service în 48h (`DELETE /api/v1/users/me`); buton în pagina `/gdpr`; email de confirmare trimis; cleanup automat la startup + interval orar
- **SEC-008** — CSP activat pe API (`@fastify/helmet`); HSTS adăugat pe frontend (`next.config.mjs`); CSP pe frontend cu domenii explicite (Google Fonts, Vercel Analytics)
- **SEC-010** — `E2E_MODE` blocat în producție (`NODE_ENV !== 'production'`); rutele de test nu mai pot fi activate pe Railway
- **SEC-011** — XSS escaping consistent în emailuri admin: `escapeHtml()` aplicat pe `name`, `title`, `body` în toate template-urile
- **SEC-014** — Rate limiting adăugat pe `POST /whatsapp/connect` (5/min) și `POST /ai/analyze-style` (3/min)
- **SEC-003/004** — Rate limiting adăugat pe `POST /admin/auth` (10/15min); PIN-ul rămâne mecanismul de autentificare admin
- **CORS** — `CORS_ORIGINS` env var pentru origini multiple (util pentru Vercel preview URLs)
- **E2E** — Rutele de test securizate cu header `x-e2e-secret`

### Refactoring & Code Quality

- **CR-007/08/09** — `console.error` înlocuit cu `logger.error` în `auth.service.ts`, `notifications.service.ts`, `admin.routes.ts`
- **CR-013** — `ThemeToggle` extras ca component shared (`apps/web/src/components/ThemeToggle.tsx`); eliminat din 4 locuri cu cod duplicat
- **CR-014** — Schema DB centralizată în `apps/api/src/db/migration-statements.ts`; `migrate.ts` și `index.ts` importă din același loc
- **CR-006** — `console.log('[DEBUG ENV]')` eliminat din `migrate.ts`
- **CR-015** — `upsertContactMemory` refactorizat cu `INSERT ... ON CONFLICT DO UPDATE` (un singur query în loc de SELECT + UPDATE/INSERT)
- **CR-022** — Rutele E2E securizate cu `x-e2e-secret` header verificat în `preHandler`
- **CR-002** — `whatsappAuthState` export eliminat din `schema.ts` (dead code — raw SQL folosit pentru Baileys)
- **CR-003** — Tipuri neutilizate eliminate din `auth.schemas.ts` (`ForgotPasswordInput`, `ResetPasswordInput`, `VerifyEmailInput`)
- **CR-004** — `getActiveSocket()` eliminat din `whatsapp.session-manager.ts` (folosit doar în mock-uri de test)

### Docs

- Creat `docs/RUNBOOK.md` — proceduri de incident (restart Railway, rollback, migrare manuală, GDPR, rate limit blocat)
- Creat `docs/ARCHITECTURE.md` — decizii de design non-evidente (dual migration, Baileys în Postgres, CJS/ESM, JWT pattern, rate limiting, GDPR flow, design tokens)
- Șters `docs/FIX.md` — toate itemele rezolvate

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
