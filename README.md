# WhatsApp AI

SaaS platform care conectează WhatsApp-ul unui business cu un agent AI. Agentul răspunde automat în locul proprietarului când acesta este inactiv, folosind stilul lui de scriere.

## Funcționalități

- **Agent AI** — răspunde automat la mesaje WhatsApp când proprietarul e inactiv
- **Personality cloning** — agentul analizează mesajele trimise anterior și mimează stilul de scriere al proprietarului
- **Memorie per contact** — agentul reține informații despre fiecare client (nume, nevoi, context)
- **Knowledge base** — informații despre business injectate în prompt (servicii, prețuri, program)
- **Transcriere vocale** — mesajele audio sunt transcrise automat (Groq Whisper)
- **Detecție sentiment** — mesajele urgente sau frustrante primesc răspunsuri adaptate
- **Timer de inactivitate** — configurable, implicit 5 minute
- **Blacklist contacte** — exclude anumiți clienți de la răspunsuri automate
- **Pauză temporară** — agent oprit X ore fără a-l dezactiva complet
- **Admin panel** — gestionare utilizatori, subscripții, configurare platformă
- **Subscripții Stripe** — plan lunar și anual cu perioadă de trial

## Comenzi WhatsApp

Controlezi agentul direct din WhatsApp, trimițindu-ți ție însuți comenzi:

```
/activateAI       — activează agentul
/deactivateAI     — dezactivează agentul
/pauseAI 2h       — pauză temporară X ore
/resumeAI         — scoate din pauză
/setTimer 10min   — schimbă timerul de inactivitate (1-60 min)
/skipAI +40758... — ignoră un contact
/unskipAI +40758  — re-activează contact
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
| AI | Groq API (Llama 3.3 70B + Whisper large v3) |
| WhatsApp | Baileys (`@whiskeysockets/baileys`) |
| Email | Resend |
| Plăți | Stripe |
| Monorepo | pnpm workspaces |

## Structură

```
apps/
  api/          — backend Fastify (REST API)
  web/          — frontend Next.js
  e2e/          — teste Playwright
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
# editează apps/api/.env cu valorile tale

cp apps/web/.env.local.example apps/web/.env.local
# editează apps/web/.env.local

# Creează baza de date (UTF-8 obligatoriu)
createdb -E UTF8 -l C -T template0 whatsapp_ai

# Rulează migrările
pnpm --filter api db:migrate

# Pornește în development
pnpm dev
```

API rulează pe `http://localhost:3001`, frontend pe `http://localhost:3000`.

### Creare cont admin

```bash
pnpm --filter api exec tsx src/scripts/set-admin.ts admin@example.com
```

## Variabile de mediu

Vezi [`apps/api/.env.example`](apps/api/.env.example) pentru lista completă.

Variabilele obligatorii:

| Variabilă | Descriere |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL |
| `JWT_ACCESS_SECRET` | Secret JWT acces (min 32 chars) |
| `JWT_REFRESH_SECRET` | Secret JWT refresh (min 32 chars) |
| `GROQ_API_KEY` | Cheie API Groq (AI + transcriere) |
| `STRIPE_SECRET_KEY` | Cheie secretă Stripe |
| `STRIPE_PRICE_MONTHLY_ID` | ID prețul lunar din Stripe |
| `STRIPE_PRICE_ANNUAL_ID` | ID prețul anual din Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret webhook Stripe |
| `RESEND_API_KEY` | Cheie API Resend (email) |
| `EMAIL_FROM` | Adresa expeditor email |
| `APP_URL` | URL frontend (ex: `https://app.example.com`) |
| `API_URL` | URL backend (ex: `https://api.example.com`) |

## Teste

```bash
# Unit + integration (156 teste)
pnpm --filter api test

# E2E Playwright (54 teste)
pnpm test:e2e
```

## Licență

Privat — toate drepturile rezervate.
