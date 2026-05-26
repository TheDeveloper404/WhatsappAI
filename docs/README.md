# docs/ — Documentație proiect WhatsApp AI

Acest folder conține documentația generată în sesiunile de lucru.
`Claude_Development_Rules/` este READ-ONLY — nu se modifică niciodată.

## Fișiere

| Fișier | Conținut |
|--------|----------|
| [PROGRESS.md](PROGRESS.md) | Faze proiect, checklist funcționalități și comenzi dev de referință |
| [CHANGELOG.md](CHANGELOG.md) | Changelog versiuni (format Keep a Changelog) |
| [TRACKING.md](TRACKING.md) | Istoric modificări, fix-uri, audit securitate, reguli de lucru |
| [PROD_READY.md](PROD_READY.md) | Checklist production readiness — ce lipsește pentru lansare |
| [ENV_VARS.md](ENV_VARS.md) | Documentație completă variabile de mediu + template `.env` |
| [AI_FEEDBACK_LOG.md](AI_FEEDBACK_LOG.md) | Greșelile AI și regulile corective stabilite |

## Stare curentă (2026-05-26)

| Categorie | Stare |
|-----------|-------|
| API tests (vitest) | ✅ 156/156 |
| E2E tests (Playwright) | ✅ 54/54 |
| Faza 7 — Landing Page | ✅ COMPLET |
| Securitate | ✅ C1, C2, H1-H4, M1 fixate |
| Production readiness | ~75% |

## Baze de date locale (dev)

| Nume | Folosit de | Encoding |
|------|-----------|---------|
| `whatsapp_ai` | API dev (`.env`) | UTF-8 |
| `whatsapp_ai_test` | vitest (`vitest.config.ts`) | UTF-8 |
| `whatsapp_ai_e2e` | Playwright (`playwright.config.ts`) | UTF-8 |

> PostgreSQL instalat via Scoop în `C:\dev\apps\postgresql\18.4\`  
> Pornire: `& "C:\dev\apps\postgresql\18.4\bin\pg_ctl.exe" start -D "C:\dev\apps\postgresql\18.4\data" -w`
