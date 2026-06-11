# CLAUDE.md — WhatsApp AI

Ghid de lucru în acest repo. Citește-l înainte de a modifica cod. Regulile globale de
inginerie (clasificare SMALL/NORMAL/CRITICAL, quality gates, securitate) vin din
`C:\dev\persist\claude\CLAUDE.md` și se aplică peste tot — aici stă **doar** ce e specific
acestui proiect.

## Ce e proiectul (pe scurt)
SaaS care leagă WhatsApp-ul unui business de un agent AI ce răspunde automat când owner-ul e
inactiv, în stilul lui de scriere. Producție: [waai.ro](https://waai.ro) (web pe Vercel) +
[api.waai.ro](https://api.waai.ro) (Railway, în spatele Cloudflare). Vezi `README.md` pentru
lista completă de funcționalități și stack.

## Structură
Monorepo pnpm workspaces:
- `apps/api` — backend Fastify + TypeScript + Drizzle, organizat pe module
  (`modules/<x>/<x>.routes.ts` → `.service.ts` → `.repository.ts` + `.schemas.ts`).
- `apps/web` — frontend Next.js 16 App Router + Tailwind + Zustand.
- `apps/e2e` — teste Playwright.
- `docs/` — `ARCHITECTURE.md` (decizii non-evidente), `BACKLOG.md`, `CHANGELOG.md`,
  `FLUX_APLICATIE.md`, `DEV_SETUP.md`, `RUNBOOK.md`, `ENV_VARS.md`, `SECURITY.md`.
- `pentest/` — artefacte audit de securitate.

## Arhitectură — citește ÎNTÂI `docs/ARCHITECTURE.md`
Conține deciziile care te-ar surprinde dacă le-ai deduce singur. Cele mai importante capcane:
- **Migrări:** source of truth = `apps/api/src/db/migration-statements.ts`. Orice tabel/coloană
  nouă se adaugă acolo (rulat din `index.ts` cu retry + safety-net idempotent în `app.ts`).
- **WhatsApp auth state e în Postgres**, nu pe disc (containere efemere pe Railway). Raw `pg`
  în `whatsapp.auth-state.ts`, intenționat (NU Drizzle) — Baileys face sute de op. mici.
- **Baileys e CJS în context ESM:** `import makeWASocket from '@whiskeysockets/baileys'`,
  fără `.js`, fără `createRequire` (ține de `module: Node16` în tsconfig).
- **State în RAM** (`pendingResponses`, throttles din `message.handler.ts`) se pierde la restart
  și nu se sincronizează între instanțe — blocaj cunoscut la scalare orizontală, NU bug.

## Reguli specifice acestui proiect (non-negociabile)
- **LLM-ul nu atinge banii.** Prețuri/totaluri/deviz se calculează în COD din DB. AI-ul doar
  *clasifică/extrage* (fază comandă, lead hot/warm/cold, intent programare) și output-ul lui e
  **validat strict în cod** (vezi `parseLeadClassification`, `analyzeOrderIntent`). Nu muta
  niciodată calcul de preț în prompt.
- **PII niciodată în loguri de producție.** Conținutul imaginilor (vision) și al mesajelor nu se
  loghează. Procesare imagini base64 in-memory.
- **Thin controllers / deny-by-default.** Logica de business stă în `.service.ts`, accesul la DB
  în `.repository.ts`. Rutele validează input (schemas) și ies. Resursele se scopează pe `userId`
  cu verificare de proprietate înainte de update/delete (IDOR-safe).
- **Gating abonament:** rutele care consumă AI trec prin `middleware/requireSubscription.ts` /
  `billing/entitlement.ts`. Fail-closed pentru funcții plătite.
- **Pârghiile de tier/abonament se verifică pe TOATE căile, nu doar pe rute.** Comenzile WhatsApp
  (`fromMe` în `message.handler.ts` → `executeCommand`) intră direct prin socket, **NU** prin
  `authenticate`/`requireActiveSubscription`. Decizie de produs: **fără abonament activ = nicio
  funcție** → `executeCommand` are un **hard wall** de entitlement la intrare (orice comandă →
  mesaj de reactivare, fără excepții). Pârghia de TIER pe `/setTimer` (Pro vs Max) e separată,
  relevantă doar pt conturi entitled. Vezi `ARCHITECTURE.md §17`. La orice comandă WhatsApp nouă:
  gate-ul global NU se aplică pe `fromMe` → verifică LOCAL.
- **Rute de test dublu-gated:** `NODE_ENV !== 'production'` **și** header `x-e2e-secret`. Nu slăbi
  niciodată una dintre condiții.
- **Fail-open doar unde e intenționat** (RAG embeddings, vision fără cheie) — nu generaliza
  pattern-ul la securitate.

## Convenții
- Limba aplicației și a documentației: **română** (diacritice incluse — fonturi cu `latin-ext`).
- Design system pe token-uri CSS mapate în Tailwind (`bg-base`, `text-ink`, `text-acid`, etc.).
  Nu hardcoda culori; folosește clasele din `docs/ARCHITECTURE.md §7`.
- Dashboard: sidebar pe desktop / drawer pe mobil, 5 intrări; „Conversații" și „Vânzări" sunt
  tab-uri pe bază de rută. Nu reintroduce ruta `/connect` (conectarea WA e inline în Dashboard).
- Pentru `apps/web`, `tsc --noEmit` NU prinde regulile ESLint — rulează `next lint`/`build`
  înainte de a considera gata (o regulă lint a picat deja un deploy Vercel).

## Workflow de dezvoltare
```bash
pnpm dev:api     # API pe :3001
pnpm dev:web     # Web pe :3000
pnpm --filter api db:migrate
```
- **Testele le rulează omul, nu Claude** (există `.claude/HUMAN_RUNS_TESTS`; hook-ul `block-tests.js`
  blochează rularea de teste). Scrie/actualizează testele, dar cere userului să le ruleze.
- Un fix pe rând. Nu începe implementare până userul nu confirmă explicit pasul.
- Niciodată commit/push direct pe `main` — branch + PR (hook `block-push-main` la nivel global).
- Secretele prod trăiesc în env-urile Railway/Vercel, niciodată în `.env` local sau în cod.

## Evidență documentație (obligatoriu, automat)
**Rolurile celor 3 docuri (nu le amesteca):**
- **`docs/CHANGELOG.md`** = ce s-a LIVRAT (cu dată). Append-only.
- **`docs/BACKLOG.md`** = ce NU e livrat **+ ORDINEA de lucru** (roadmap pe etape). Sursa de adevăr pentru „ce urmează".
  Aici stau TOATE itemele de implementat. **La început de sesiune, citește BACKLOG ca să știi ordinea de atac.**
- **`.remember/remember.md`** = unde am rămas (stare VOLATILĂ: în-curs, branch, env) + capcane/gotchas active + pointer
  la BACKLOG. NU ține definiții de work (alea-s în BACKLOG); NU ține lucruri livrate (alea-s în CHANGELOG).

Când termini de implementat ceva (finalizat + verificat), fă AUTOMAT, fără să fie cerut:
1. **Adaugă în CHANGELOG** sub `[Unreleased]`, cu data curentă (Added/Changed/Fixed/Removed/Security).
2. **Șterge itemul din BACKLOG** (sau bifează apoi mută) — fără evidență dublă.
3. **Actualizează starea volatilă din remember** (ce s-a închis, ce urmează) — pointer la BACKLOG, nu re-descrie work-ul.

Regula scurtă: **de implementat → BACKLOG (ordonat); livrat → CHANGELOG (cu dată); volatil + gotchas → remember.**

## Securitate
Postură și audituri în `docs/SECURITY.md`. La orice feature nou verifică: prompt injection,
rate limiting per rută (`global: false`, fiecare rută optează explicit), PII în loguri, IDOR.
Pentru lucru CRITICAL (auth, plăți, permisiuni) → audit complet de securitate înainte de merge.
