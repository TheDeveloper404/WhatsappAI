# WhatsApp AI

SaaS platform care conectează WhatsApp-ul unui business cu un agent AI. Agentul răspunde automat în locul proprietarului când acesta este inactiv, folosind stilul lui de scriere.

**Producție:** [waai.ro](https://waai.ro) · API: [api.waai.ro](https://api.waai.ro) (Railway, fronted de Cloudflare)

## Funcționalități

- **Agent AI** — răspunde automat la mesaje WhatsApp când proprietarul e inactiv
- **Personality cloning** — agentul analizează mesajele trimise anterior și mimează stilul de scriere al proprietarului
- **Memorie per contact** — agentul reține informații despre fiecare client (nume, nevoi, context)
- **Knowledge base** — informații despre business injectate în prompt (servicii, prețuri, program)
- **RAG / documente** — owner-ul încarcă PDF/DOCX/TXT (max 10 MB); agentul caută în ele (embeddings Gemini + cosine în cod) și răspunde din conținutul real, fără să inventeze
- **Comenzi prin WhatsApp** — catalog de produse (cu import CSV), AI extrage comanda din conversație, owner o gestionează în dashboard. Prețurile/totalul se calculează în cod din DB, niciodată de LLM
- **Preț estimativ („de la")** — servicii pe proiect custom: agentul nu propune total fix, strânge cerințele și predă owner-ului pentru ofertă personalizată
- **Programări** — servicii rezervabile (frizerie, clinică): agentul strânge serviciul + intervalul + numele, creează o programare și predă owner-ului confirmarea intervalului (pagina Programări)
- **Calificare lead-uri** — fiecare contact e clasificat automat hot/warm/cold (scor + justificare) după criteriile owner-ului; AI-ul doar clasifică, validarea output-ului e în cod (pagina Lead-uri)
- **Vision (citește poze)** — clientul trimite o imagine (ex. captură de comandă); agentul extrage datele relevante (Gemini vision, procesare in-memory)
- **Email confirmare comandă** — la cerere, clientul primește un email cu rezumatul comenzii (Resend); datele sunt pre-formatate în cod, nu de LLM
- **Gatekeeper business-only** — refuză cereri off-topic (bancuri, rețete) și prompt injection (keyword + LLM)
- **Statistici & metrici** — activitate AI (azi/7z/lună) + performanță agent (rată rezolvare, escaladări, grafic 7 zile)
- **Transcriere vocale** — mesajele audio sunt transcrise automat (Groq Whisper)
- **Detecție sentiment** — mesajele urgente sau frustrante primesc răspunsuri adaptate
- **Timer de inactivitate** — configurabil, implicit 5 minute
- **Blacklist contacte** — exclude anumiți clienți de la răspunsuri automate
- **Pauză temporară** — agent oprit X ore fără a-l dezactiva complet
- **Admin panel** — gestionare utilizatori, subscripții, configurare platformă
- **Subscripții Stripe** — plan lunar și anual cu perioadă de trial
- **GDPR** — ștergere cont self-service în 48h din pagina `/gdpr`

## Securitate

- CSP + HSTS pe API și frontend
- Rate limiting per rută (login, register, admin auth, WhatsApp connect, AI analyze)
- JWT access token 15min + refresh token 7 zile cu rotație, hash în DB
- Token hash stocat în DB (compromiterea DB nu expune tokens)
- XSS escaping în toate emailurile trimise
- PII exclus din loguri de producție
- E2E_MODE blocat în producție (rute de test dublu-gated: `NODE_ENV !== 'production'` + header `x-e2e-secret`)
- IDOR-safe: toate resursele scopate pe `userId`, cu verificare de proprietate înainte de update/delete
- Stripe webhook cu verificare de semnătură (raw body) + deduplicare evenimente
- Audit securitate (2026-06-02): Semgrep (~200 reguli OWASP/secrets/security-audit) + review manual → 0 vulnerabilități

## Comenzi WhatsApp

Controlezi agentul direct din WhatsApp, trimițindu-ți ție însuți comenzi:

```
/activateAI       — activează agentul
/deactivateAI     — dezactivează agentul
/pauseAI 2h       — pauză temporară X ore
/resumeAI         — scoate din pauză
/setTimer 10min   — schimbă timerul de inactivitate (1-60 min)
/clearHistory     — șterge istoricul conversației curente
/status           — stare curentă agent
/help             — lista tuturor comenzilor
```

## Stack

| Layer | Tehnologie |
|---|---|
| Backend | Fastify 4, Node.js 24, TypeScript |
| Frontend | Next.js 14 App Router, Tailwind CSS, Zustand |
| Bază de date | PostgreSQL, Drizzle ORM |
| AI | Groq (Llama 3.3 70B) sau Gemini 2.5 Flash — comutabil via `LLM_PROVIDER`; voce mereu pe Groq Whisper; vision + embeddings (RAG) pe Gemini |
| WhatsApp | Baileys (`@whiskeysockets/baileys`) |
| Email | Resend |
| Plăți | Stripe |
| Monorepo | pnpm workspaces |
| Deploy | Railway (API) + Vercel (Frontend) |

## Structură

```
apps/
  api/          — backend Fastify (REST API)
  web/          — frontend Next.js
  e2e/          — teste Playwright
docs/
  ARCHITECTURE.md     — decizii de design non-evidente
  CHANGELOG.md        — istoricul versiunilor
  BACKLOG.md          — ce rămâne de făcut (necesare / nice-to-have / pe viitor) + referințe livrate
  FLUX_APLICATIE.md   — ghidul complet din perspectiva owner-ului (setări dashboard, exemple)
  DEV_SETUP.md        — comenzi dev și setup local
  RUNBOOK.md          — proceduri de incident
  env_vars.md         — documentație variabile de mediu
  security.md         — audit de securitate + postură (Semgrep + review manual)
```

## Rulare locală

### Cerințe

- Node.js 20+
- pnpm 9+
- PostgreSQL 14+

### Setup

```bash
# Instalează dependențele
pnpm install

# Configurează variabilele de mediu
cp apps/api/.env.example apps/api/.env
# editează apps/api/.env cu valorile tale (vezi docs/env_vars.md)

# Creează bazele de date (UTF-8 obligatoriu pe Windows)
# În psql -U postgres:
# CREATE DATABASE whatsapp_ai      ENCODING='UTF8' LC_COLLATE='C' LC_CTYPE='C' TEMPLATE=template0;
# CREATE DATABASE whatsapp_ai_test ENCODING='UTF8' LC_COLLATE='C' LC_CTYPE='C' TEMPLATE=template0;
# CREATE DATABASE whatsapp_ai_e2e  ENCODING='UTF8' LC_COLLATE='C' LC_CTYPE='C' TEMPLATE=template0;

# Rulează migrările
pnpm --filter api db:migrate

# Pornește în development
pnpm dev:api   # Terminal 1 — API pe http://localhost:3001
pnpm dev:web   # Terminal 2 — Frontend pe http://localhost:3000
```

### Creare cont admin

```bash
pnpm --filter api exec tsx src/scripts/set-admin.ts admin@example.com
```

## Variabile de mediu

Vezi [`docs/env_vars.md`](docs/env_vars.md) pentru documentație completă și template `.env`.

Variabilele obligatorii:

| Variabilă | Descriere |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL |
| `JWT_ACCESS_SECRET` | Secret JWT acces (min 32 chars) |
| `JWT_REFRESH_SECRET` | Secret JWT refresh (min 32 chars) |
| `GROQ_API_KEY` | Cheie API Groq (AI + transcriere; necesar mereu, chiar pe Gemini) |
| `LLM_PROVIDER` | `groq` (default) sau `gemini` — furnizor text (opțional) |
| `GEMINI_API_KEY` | Cheie Google Gemini (doar dacă `LLM_PROVIDER=gemini`) |
| `STRIPE_SECRET_KEY` | Cheie secretă Stripe |
| `STRIPE_PRICE_MONTHLY_ID` | ID prețul lunar din Stripe |
| `STRIPE_PRICE_ANNUAL_ID` | ID prețul anual din Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret webhook Stripe |
| `RESEND_API_KEY` | Cheie API Resend (email) |
| `EMAIL_FROM` | Adresa expeditor email |
| `APP_URL` | URL frontend (ex: `https://app.example.com`) |
| `CORS_ORIGINS` | Origini CORS extra, separate prin virgulă (opțional) |
| `ADMIN_SECRET` | Cod acces panou admin (min 32 chars; login emite token de sesiune de 2h) |
| `E2E_SECRET` | Header secret pentru rutele de test (opțional, min 16 chars) |

## Teste

```bash
# Unit + integration
pnpm --filter api test

# E2E Playwright (54 teste)
cd apps/e2e && pnpm exec playwright test
```

## Licență

Privat — toate drepturile rezervate.
