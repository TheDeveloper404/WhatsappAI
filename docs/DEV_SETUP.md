# DEV SETUP — WhatsApp AI (personal)

## Prima instalare

```bash
pnpm install                                   # actualizează și pnpm-lock.yaml dacă e cazul
cp apps/api/.env.example apps/api/.env         # completează OPENROUTER_API_KEY etc.

# Postgres local în Docker
docker run -d --name wa-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=whatsapp_ai -p 5432:5432 postgres:16-alpine
```

## Pornire

```bash
pnpm dev:api        # API + dashboard pe http://localhost:3001 (migrările rulează automat la start)
```

QR-ul de asociere apare în terminal și în dashboard. După scanare, în chatul „Tu" trimite
`/activateAI`, apoi scrie-i de pe alt număr ca să testezi răspunsul (timer-ul pornește doar după ce
tu ai răspuns manual contactului; dacă n-ai răspuns deloc, AI-ul răspunde imediat).

## Verificări

```bash
pnpm typecheck                  # tsc --noEmit
pnpm --filter api test          # vitest (unit: command.parser, message.handler, inactivity.tracker)
pnpm db:migrate                 # migrări manuale (idempotente)
```
