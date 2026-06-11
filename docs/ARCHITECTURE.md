# ARCHITECTURE — Decizii de Design WhatsApp AI

## Stack

| Layer | Tehnologie |
|-------|-----------|
| Frontend | Next.js 16 App Router, Tailwind CSS, Zustand |
| Backend | Fastify, TypeScript, Drizzle ORM |
| Database | PostgreSQL (Railway) |
| WhatsApp | Baileys (Signal Protocol) |
| AI — text | Groq Llama 3.3 70B (default) · Gemini 2.5 Flash (opțional, prin `LLM_PROVIDER=gemini`) |
| AI — voce | Groq Whisper Large V3 (mereu pe Groq, indiferent de `LLM_PROVIDER`) |
| AI — vision | Gemini 2.5 Flash (citire imagini la comandă) |
| AI — embeddings (RAG) | Gemini `text-embedding-004` |
| Email | Resend |
| Payments | Stripe |
| Deploy | Vercel (web) + Railway (api) + Cloudflare (DNS/CDN/HTTPS) |

---

## Decizii non-evidente

### 1. Dual migration — `index.ts` + `app.ts`

**De ce există două locuri cu SQL de migrare?**

- `index.ts` rulează **toate** migrările (`migration-statements.ts`) cu retry logic (5 încercări, 3s pauză) înainte să pornească serverul. Necesar pe Railway Hobby unde Postgres poate dormi la startup.
- `app.ts` → `runStartupMigrations()` rulează un subset de migrări idempotente (`ALTER TABLE IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`) ca safety net pentru deploy-uri care sar peste `index.ts` în anumite scenarii edge.

**Source of truth:** `apps/api/src/db/migration-statements.ts` — orice tabel sau coloană nouă se adaugă aici.

---

### 2. Baileys — WhatsApp auth state în PostgreSQL, nu pe disc

**De ce nu folosim fișiere locale pentru sesiunile WhatsApp?**

Baileys stochează implicit credențialele și cheile Signal Protocol pe disc. Pe Railway, containerele sunt efemere — un restart șterge tot. 

**Soluția:** implementare custom `makeWASocket` cu auth state în PostgreSQL (`whatsapp_auth_state` table). La restart, `restoreAllSessions()` reconectează automat sesiunile active din DB.

**De ce raw SQL în `whatsapp.auth-state.ts` în loc de Drizzle ORM?**

Baileys face sute de operații mici de read/write pe cheile Signal Protocol în paralel. Raw pg Pool cu queries directe este mai rapid și mai puțin overhead decât ORM pentru acest pattern specific de acces.

---

### 3. Baileys — import CJS în context ESM

**Problema:** Baileys este distribuit ca CommonJS, iar proiectul folosește `"type": "module"` (ESM).

**Workaround:** în `tsconfig.json`, `"module": "Node16"` cu `"moduleResolution": "Node16"` permite import mixt CJS/ESM. Import-ul se face cu:
```ts
import makeWASocket from '@whiskeysockets/baileys'
```
fără extensie `.js` și fără `createRequire`.

---

### 4. JWT + Refresh Token cu silent retry

**Pattern:** access token (15 min) + refresh token (7 zile, HttpOnly cookie).

- La expirare access token, frontend face automat `POST /api/v1/auth/refresh`
- Refresh token rotates la fiecare refresh (noul token în DB, vechiul invalidat)
- Token hash stocat în DB (nu token-ul raw) — compromiterea DB nu expune tokens

**Unde:** `apps/web/src/lib/api.ts` → funcția `request()` cu retry automat la 401.

---

### 5. Rate limiting — strategie per rută

`@fastify/rate-limit` e înregistrat cu `global: false` — fiecare rută optează explicit. Ratele diferențiate reflectă costul operației:

| Rută | Limită | Motiv |
|------|--------|-------|
| `POST /auth/login` | 10/15min per IP | Brute force protecție |
| `POST /auth/register` | 5/h per IP | Spam protecție |
| `POST /admin/auth` | 10/15min | Brute force PIN |
| `POST /whatsapp/connect` | 5/min | Inițiere conexiune WA costisitoare |
| `POST /ai/analyze-style` | 3/min | Apel extern Groq |

---

### 6. GDPR — ștergere cont (confirmare pe email)

**Flow (double opt-in pe email):**
1. User apelează `POST /api/v1/users/me/deletion-request` cu parola (autentificat)
2. Se generează un token de confirmare (hash HMAC-SHA256 în `deletion_token`, raw doar în email), expiry 1h
3. Email cu link `/sterge-cont?token=…` trimis utilizatorului
4. User apasă linkul → `POST /api/v1/users/me/deletion-confirm` (fără autentificare — token-ul *este* dovada)
5. `disconnectSession(userId)` închide sesiunea WhatsApp live (socket Baileys din memorie + auth state), apoi se șterge userul — CASCADE șterge toate datele asociate (PostgreSQL FK constraints). **Ireversibil.**

Confirmarea prin email împiedică ștergerea cu un access token furat: chiar știind parola, atacatorul nu poate finaliza fără acces la emailul victimei. Token single-use, mesaj generic la token invalid (fără enumerare).

---

### 7. Design system — token-uri CSS

Toate culorile și fonturile sunt definite ca variabile CSS și mapate în Tailwind:

| Token | Tailwind class | Rol |
|-------|---------------|-----|
| `--bg` | `bg-base` | Background principal |
| `--ink` | `text-ink` | Text primar |
| `--dim` | `text-dim` | Text secundar |
| `--dimmer` | `text-dimmer` | Text terțiar/placeholder |
| `--acid` | `text-acid` | Accent verde (#C8FB4A) |
| `--line` | `border-line` | Borduri |
| `--card-hi` | `bg-cardhi` | Hover state carduri |

Dark mode: clasa `html.dark` + `localStorage['wa-ai-theme']`.

**Fonturi:** self-hostate prin `next/font/google` (Space Grotesk + Geist Mono, expuse ca `--font-space-grotesk` / `--font-geist-mono`, cu `latin-ext` pentru diacritice RO). NU se mai încarcă prin `<link>` sincron spre Google Fonts (bloca randarea ~2s pe mobil). `globals.css` are și `html, body { overflow-x: clip }` — guard contra „shrink-to-fit" pe Safari iOS.

---

### 8. Statistici AI — fus orar și fereastră de timp

`getStats` (`ai.repository.ts`) calculează „azi / 7 zile / lună" pe **ora României** (`Europe/Bucharest`), nu UTC.

- `startOfDayInTz` / `startOfMonthInTz` folosesc `Intl.DateTimeFormat` pentru a deriva miezul nopții local și convertesc înapoi în epoch ms, ținând cont de **DST** (offset-ul se recalculează la momentul interogării).
- „Azi" = de la miezul nopții local; „7 zile" = azi + ultimele 6 zile; „luna" = **luna calendaristică curentă** (de la zi 1), nu ultimele 30 de zile rolling.

**De ce contează:** userii sunt în RO — un contor „azi" pe UTC ar fi decalat 2–3h. Iar pentru viitoarele limite lunare per plan ai nevoie de lună calendaristică reală.

---

### 9. Webhook Stripe — deduplicare evenimente

Stripe livrează evenimente **at-least-once** (poate retrimite același event la retry/timeout).

**Soluție:** tabel `stripe_events(id, type, created_at)`. La intrarea în handler facem `INSERT ... ON CONFLICT (id) DO NOTHING`; dacă `rowCount === 0`, evenimentul a fost deja procesat → răspundem `200 { duplicate: true }` fără a re-rula logica.

Necesar mai ales înainte de a adăuga logică **ne-idempotentă** (contoare, emailuri, credite) în handlerele de webhook.

---

### 10. State în memorie — limită cunoscută (NU rezolvat)

`pendingResponses` (timere răspuns AI) și `lastNotified` / `lastMemoryUpdate` (throttle) din `message.handler.ts` trăiesc în RAM-ul procesului.

- **Se pierd la restart** (Railway repornește containerul → timerele programate dispar).
- **Nu se sincronizează** între instanțe multiple.

Acceptabil pe Railway single-instance. **Blocaj la scalare orizontală** — soluția ar fi mutarea pe Redis/DB. De abordat doar când se trece la 2+ instanțe.

---

## Module funcționale livrate (decizii-cheie)

Conversația cu clientul e orchestrată în `message.handler.ts`, care ramifică pe trei moduri de tranzacție în funcție de cum e marcat produsul. Deciziile non-evidente, per modul:

### 11. Comenzi (`modules/orders/`)
- **Banii se calculează în COD, niciodată de LLM.** `analyzeOrderIntent` (Groq, temp 0) doar *clasifică* faza (none/collecting/ready) și mapează pe catalog; totalul se compune din prețurile reale din DB. Previne ca modelul să inventeze prețuri.
- **Stoc scăzut atomic** (`decrementStock`, `WHERE stock >= qty`) la confirmare — previne supravânzarea pe ultimul produs (race a 2 clienți). Produse `stock = NULL` = nelimitat (servicii).
- `public_ref` (`ord_xxx`) ca „număr de bon" lizibil; UUID-ul rămâne intern.

### 12. Programări (`modules/orders/appointments.*`)
- Flag `products.isBookable`. `analyzeBookingIntent` strânge serviciu + interval (text liber) + nume → creează programare `pending` → notifică owner-ul „📅 Programare nouă". **Handoff ușor: owner-ul confirmă intervalul** (AI-ul NU confirmă singur — nu există verificare de disponibilitate). Auto-confirmare cu disponibilitate reală/calendar = B6 în BACKLOG.

### 13. Calificare lead-uri (`classifyLead` în `groq.client.ts`)
- LLM-ul *doar clasifică* (hot/warm/cold + scor 0-100 + justificare), pe baza `ai_settings.lead_criteria` (text liber per business). **Output-ul e validat strict în cod** (`parseLeadClassification`: scor plafonat, status validat, fallback `cold`). Tabel `lead_insights`.

### 14. RAG / documente (`modules/knowledge/`)
- Owner-ul încarcă PDF/DOCX/TXT (max 10 MB) → text extras → embeddings Gemini `text-embedding-004`, stocate ca `jsonb`. La retrieval, **cosine similarity calculat în cod** (fără pgvector), top-3 peste prag, **fail-open** (eroare embeddings nu blochează răspunsul). Tabele `documents`, `document_chunks`.

### 15. Vision + Preț estimativ
- **Vision:** `extractFromImage` (Gemini) — imagine procesată **base64 in-memory**, doar `image/*`, fără conținut în loguri (PII), fail-open fără cheie.
- **Preț estimativ:** flag `products.isEstimate` → agentul NU dă total fix / NU înregistrează comandă; rămâne în discovery și face handoff tăcut „📌 Lead nou (ofertă custom)".

### 16. Navigare dashboard (web)
- Meniu **fix pe desktop (sidebar) / drawer pe mobil**, grupat în 5 intrări: Principal (Dashboard · Conversații · Vânzări) + Cont (Setări · Profil). „Conversații" și „Vânzări" sunt **tab-uri pe bază de rută** (`ConversationsTabs` → conversations/leads; `SalesTabs` → products/orders/appointments) — paginile rămân rute independente, doar grupate vizual. Conectarea WhatsApp e inline în pagina Dashboard (nu mai există rută `/connect`).

### 17. Comenzi WhatsApp (`executeCommand`) — calea `fromMe` sare gate-urile globale
Owner-ul își controlează agentul trimițându-și comenzi pe propriul WhatsApp (`/activateAI`, `/setTimer`, `/confirma prg_xxx` etc.). Aceste mesaje au `fromMe=true` și intră în `message.handler.ts` **direct prin socket-ul Baileys** — NU prin aplicația web, deci **NU trec prin `authenticate`/`requireActiveSubscription`**. Ramura `fromMe` sare gate-ul global de abonament. **Decizie de produs: fără abonament activ = NICIO funcție a aplicației** (ca dashboard-ul, care redirecționează la `/subscribe`). De aceea `executeCommand` are un **HARD WALL** la intrare: orice comandă de la un cont fără `userHasEntitlement` primește un singur mesaj de reactivare și se oprește — **fără excepții** (nici control, nici booking). La expirare agentul e oricum auto-dezactivat de webhook, deci nicio comandă nu e necesară. **Regulă pt comenzi noi:** gate-ul global NU se aplică pe `fromMe`, deci verificarea de abonament stă LOCAL (hard wall-ul o acoperă). Pârghia de **TIER** (`/setTimer` = `minTimerMinutes`, Pro vs Max) e separată, relevantă doar pt conturi entitled. Generarea AI propriu-zisă e acoperită separat de **choke point-ul unic** din `sendAiResponse` (`userHasEntitlement` + plafon lunar), care prinde ambele căi (răspuns imediat + programat).

### 18. Notificări în-app (`modules/notifications/`)
Tabela `notifications` (generică, scopată pe `userId`) alimentează atât notificările admin (modulul `admin`), cât și pe cele user-facing (clopoțelul din dashboard, B15). Rutele user (`GET /notifications`, `POST /notifications/read`) au DOAR `authenticate` (intenționat fără `requireActiveSubscription` — userul trebuie să-și vadă notificările chiar cu trial/abonament expirat, ex. „trial prelungit"). Primul producător de notificări user = extinderea trial-ului din admin.
