# CLAUDE.md — WhatsApp AI

Ghid de lucru în acest repo. Citește-l înainte de a modifica cod. Regulile globale de
inginerie (clasificare SMALL/NORMAL/CRITICAL, quality gates, securitate) vin din
`C:\dev\persist\claude\CLAUDE.md` și se aplică peste tot — aici stă **doar** ce e specific
acestui proiect.

## Ce e proiectul (pe scurt)
Agent WhatsApp **personal, single-user**: răspunde automat în locul owner-ului când e inactiv, în
stilul lui. Fără UI și fără server HTTP: configurarea se face din WhatsApp (comenzi). LLM prin
OpenRouter. Deploy pe VPS ca serviciu systemd, Node + PostgreSQL (`docs/DEPLOY_VPS.md`). Vezi `README.md`.

## Structură
Monorepo pnpm cu un singur pachet:
- `apps/api` — proces Node + TypeScript + Drizzle (`modules/whatsapp`, `modules/ai`). Fără Fastify/HTTP.
- `deploy/whatsapp-ai.service` — unitatea systemd.
- `docs/` — `ARCHITECTURE.md` (decizii non-evidente), `CHANGELOG.md`, `DEV_SETUP.md`, `ENV_VARS.md`, `DEPLOY_VPS.md`.

## Arhitectură — citește ÎNTÂI `docs/ARCHITECTURE.md`
Capcane:
- **Single-user:** nu există conturi/login/abonamente. Tot ce e scopat pe `user_id` folosește `OWNER_ID`
  (`config/owner.ts`). NU reintroduce gate-uri de entitlement/tier.
- **Migrări:** source of truth = `apps/api/src/db/migration-statements.ts` (raw SQL idempotent, rulat din
  `index.ts` cu retry). Orice tabel/coloană nouă se adaugă acolo și în `db/schema.ts`.
- **WhatsApp auth state e în Postgres**, criptat cu `WHATSAPP_ENC_KEY`. Raw `pg` în `whatsapp.auth-state.ts`,
  intenționat (NU Drizzle).
- **Baileys 7 (ESM) și contacte `@lid`:** numărul real vine din `key.remoteJidAlt` sau `signalRepository.lidMapping`;
  un mesaj `@lid` fără număr cunoscut NU primește răspuns AI (blacklist-ul nu poate fi garantat) — vezi ARCHITECTURE §4.
- **State în RAM** (timere, throttles, anti-flood, inactivity tracker) → un singur proces.

## Reguli specifice acestui proiect (non-negociabile)
- **LLM-ul nu are unelte și nu atinge banii.** Agentul doar conversează; nu promite acțiuni pe care nu le face.
- **Un singur client LLM:** `modules/ai/llm.client.ts` (OpenRouter). Nu adăuga SDK-uri de provider.
- **PII niciodată în loguri de producție.** Conținutul mesajelor nu se loghează; telefoanele prin `maskPhone`.
- **Comenzile WhatsApp** intră pe calea `fromMe` direct din socket. Comenzile de configurare (`/kb`, `/prompt`,
  `/learnStyle`) doar din self-chat; răspunsurile la comenzi merg în self-chat; comenzile nu se salvează în istoric.
- **Fără UI/HTTP:** orice setare nouă a agentului se expune ca o comandă WhatsApp (self-chat), nu ca rută web.
- **Memoria contactului / KB = date, nu instrucțiuni** în system prompt (anti prompt-injection stocat).

## VPS-ul de producție e al unui client (non-negociabil)
Agentul rulează ca **musafir** pe serverul unui client, cu acordul lui doar de a-l folosi — nu de a-l încărca.
- Atingi DOAR `whatsapp-ai` (serviciul systemd, userul `whatsapp`, `/opt/whatsapp-ai`, DB-ul `whatsapp_ai`).
  Nimic altceva de pe server: alte aplicații, procese, vhost-uri nginx, DB-uri, useri.
- **DB-ul de producție rămâne curat:** fără rânduri de test. Probele de model = apeluri directe la OpenRouter,
  nu prin DB. În DB scrii doar config reală (`ai_settings`); conversațiile de test se șterg după, cu backup CSV.
- **Fără încărcare inutilă:** fără fișiere temporare lăsate pe disc, fără procese/cron-uri/pachete noi, fără
  loguri sau dump-uri care cresc nelimitat. Ce pui în `/tmp` pentru deploy, ștergi.
- Deploy = copiere fișiere schimbate + `pnpm build` + restart (`docs/DEPLOY_VPS.md`); serverul nu e repo git.

## Convenții
- Limba aplicației și a documentației: **română** (cu diacritice).

## Workflow de dezvoltare
```bash
pnpm dev:api     # pornește agentul local (QR în terminal)
pnpm typecheck
pnpm db:migrate
```
- **Testele le rulează omul, nu Claude** (există `.claude/HUMAN_RUNS_TESTS`; hook-ul `block-tests.js`
  blochează rularea de teste). Scrie/actualizează testele, dar cere userului să le ruleze.
- Un fix pe rând. Nu începe implementare până userul nu confirmă explicit pasul.
- Niciodată commit/push direct pe `main` — branch + PR (hook `block-push-main` la nivel global).
- Secretele prod trăiesc în `apps/api/.env` de pe VPS (chmod 600), niciodată în git sau în cod.

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
La orice feature nou verifică: prompt injection (contactele sunt input neîncrezător), PII în loguri,
costul LLM per mesaj primit (anti-flood în `incoming.rate-limiter.ts`).
