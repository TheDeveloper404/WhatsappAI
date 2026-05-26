# ARCHITECTURE — Decizii de Design WhatsApp AI

## Stack

| Layer | Tehnologie |
|-------|-----------|
| Frontend | Next.js 14 App Router, Tailwind CSS, Zustand |
| Backend | Fastify, TypeScript, Drizzle ORM |
| Database | PostgreSQL (Railway) |
| WhatsApp | Baileys (Signal Protocol) |
| AI | Groq (LLaMA) |
| Email | Resend |
| Payments | Stripe |
| Deploy | Vercel (web) + Railway (api) |

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

### 6. GDPR — ștergere cont în 48h

**Flow:**
1. User apelează `DELETE /api/v1/users/me`
2. Se setează `deletion_scheduled_at = now() + 48h` pe user
3. Toate refresh tokens sunt șterse (user delogat imediat)
4. Email de confirmare trimis
5. La startup și la fiecare oră: `deletePendingDeletionUsers()` șterge userii cu `deletion_scheduled_at < now()` — CASCADE șterge toate datele asociate (PostgreSQL FK constraints)

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
