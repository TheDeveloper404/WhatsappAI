# DEV SETUP — WhatsApp AI (personal)

Aplicația rulează pe VPS (vezi `DEPLOY_VPS.md`). Local ai nevoie doar de Git + Node 22 + pnpm, pentru
dependențe/lockfile, typecheck și teste.

```bash
corepack enable
pnpm install          # actualizează pnpm-lock.yaml după schimbări în package.json
pnpm typecheck
pnpm --filter api test
```

Rulare locală (opțional — cere un Postgres accesibil și `apps/api/.env` completat):
```bash
pnpm dev:api          # QR în terminal; migrările rulează automat la start
```
Nu rula local și pe VPS în același timp cu același număr de WhatsApp.
