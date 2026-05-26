# DEV SETUP — WhatsApp AI

## Pornire servere (la fiecare sesiune de lucru)

```bash
# Terminal 1 — API (Fastify pe port 3001)
pnpm dev:api

# Terminal 2 — Frontend (Next.js pe port 3000)
pnpm dev:web

# Terminal 3 — Stripe webhooks (DOAR când lucrezi la billing/subscripții)
stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe
# ATENȚIE: fără --forward-to nu forwardează nimic
```

## Baza de date

```bash
# Rulează migrările (creează tabelele noi, nu șterge date existente)
pnpm --filter api db:migrate
```

> **IMPORTANT (Windows):** La prima instalare, creează toate DB cu UTF-8 explicit:
> ```sql
> CREATE DATABASE whatsapp_ai ENCODING='UTF8' LC_COLLATE='C' LC_CTYPE='C' TEMPLATE=template0;
> CREATE DATABASE whatsapp_ai_test ENCODING='UTF8' LC_COLLATE='C' LC_CTYPE='C' TEMPLATE=template0;
> CREATE DATABASE whatsapp_ai_e2e ENCODING='UTF8' LC_COLLATE='C' LC_CTYPE='C' TEMPLATE=template0;
> ```
> Pe Windows, PostgreSQL creează implicit cu encoding WIN1252 → diacriticele românești generează eroare `22P05`.

## Teste

```bash
# Rulează toate testele o dată
pnpm --filter api test

# Watch mode (se reexecută la modificări)
pnpm --filter api test:watch

# Cu raport de acoperire
pnpm --filter api test:coverage
```

## E2E Playwright

```powershell
# Din apps/e2e/ — Playwright pornește API + web automat cu E2E_MODE=true
cd D:\production_mode\WhatsappAI\apps\e2e
pnpm exec playwright test
```

## Stripe CLI

```bash
# Autentificare (o singură dată, persistă)
stripe login

# Retrimite un eveniment deja procesat (util când serverul era oprit)
stripe events resend <event_id>

# Listează ultimele evenimente
stripe events list --limit=5
```

## Utilitare

```bash
# Oprește toate procesele node (dacă portul e ocupat / EADDRINUSE)
Get-Process node | Stop-Process -Force   # PowerShell
taskkill /F /IM node.exe                 # CMD

# Instalează dependențe după clone sau pull
pnpm install
```

## Prima instalare (clone fresh)

```powershell
# 0. Pornește PostgreSQL (dacă nu e pornit)
& "C:\dev\apps\postgresql\18.4\bin\pg_ctl.exe" start -D "C:\dev\apps\postgresql\18.4\data" -w

# 1. Creează bazele de date (o singură dată pe mașina nouă) — vezi secțiunea DB de mai sus

pnpm install                        # 2. instalează toate dependențele
pnpm --filter api db:migrate        # 3. creează tabelele în whatsapp_ai
pnpm dev:api                        # 4. pornește API
pnpm dev:web                        # 5. pornește frontend (terminal separat)
stripe listen --forward-to ...      # 6. webhooks Stripe (dacă lucrezi la billing)
```
