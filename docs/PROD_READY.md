# Production Readiness — WhatsApp AI

**Ultima verificare:** 2026-05-26  
**Stare cod:** 156/156 API ✅ · 54/54 E2E ✅  
**Securitate auditată:** C1, C2, H1, H2, H3, H4, M1 fixate ✅  
**Deployment:** API pe Railway ✅ · Frontend pe Vercel ✅

---

## Pași în ordinea în care trebuie făcuți

### 🔴 BLOCKER — fără acestea nu poți lansa

| # | Ce | Afectează teste? | Status |
|---|----|-----------------|--------|
| 1 | **PostgreSQL cloud** — DB locală = risc pierdere date la restart server. | NU | ✅ Railway Postgres |
| 2 | **Resend domain verificat** — acum trimite email doar la adresa contului Resend. Domeniu propriu necesar pentru utilizatori reali. | NU | ⏳ Pending |
| 3 | **Stripe live keys + webhook URL real** | NU | ✅ Live keys setate |
| 4 | **Deployment config** — Dockerfile + hosting. | NU | ✅ Railway (API) + Vercel (web) |

---

### 🟠 PRE-DEPLOY — rezolvate ✅

| # | Ce | Fișier | Status |
|---|----|--------|--------|
| 5 | **Logging oprit în test, activ în producție** | `apps/api/src/app.ts` | ✅ `logger: env.NODE_ENV !== 'test'` |
| 6 | **Security headers** | `app.ts` + `next.config.mjs` | ✅ `@fastify/helmet` + CSP headers Next.js |

---

### 🟡 IMPORTANT — necesar pentru achiziție utilizatori

| # | Ce | Afectează teste? |
|---|----|-----------------|
| 7 | **Landing Page (Faza 7)** ✅ — Hero, Pricing, HowItWorks, Features, Differentiator, FAQ, Footer. | NU |

---

### ⚪ RISC PERMANENT — nu are soluție ieftină

| # | Ce | Afectează teste? |
|---|----|-----------------|
| 8 | **WhatsApp Baileys = API neoficial** — contul poate fi banat de Meta oricând. Alternativa sigură = WhatsApp Business API oficial (scump). | NU |

---

### ⚪ NICE TO HAVE — post-lansare

| # | Ce | Afectează teste? |
|---|----|-----------------|
| 9 | **Uptime monitoring** — platformele de hosting (Railway, Fly.io) oferă logs și error tracking built-in. Sentry e redundant dacă folosești una din ele. | NU |

---

### ⚪ INFRASTRUCTURĂ — notă importantă

> **Toate cele 3 baze de date** trebuie create cu `ENCODING='UTF8' TEMPLATE=template0`:
> `whatsapp_ai` (producție), `whatsapp_ai_test` (vitest), `whatsapp_ai_e2e` (Playwright).
> Pe Windows, PostgreSQL creează cu WIN1252 implicit → diacriticele românești generează eroare `22P05`.
> Vezi `docs/ENV_VARS.md` pentru comenzile complete de setup.

---

## Concluzie

**Niciun pas de mai sus nu afectează testele API existente.**  
Testele rulează cu `NODE_ENV=test` și baza de date separată — complet izolate de config-ul de producție.

| Categorie | % |
|-----------|---|
| Cod backend + securitate | ~95% |
| Frontend app | ~85% |
| Landing page | 100% |
| Deployment / infra | ~95% |
| Servicii externe configurate | ~80% |
| **Overall** | **~90%** |

### URLs producție
| Serviciu | URL |
|----------|-----|
| Frontend (Vercel) | https://whatsapp-ai-web-rho.vercel.app |
| API (Railway) | https://api-production-2318d.up.railway.app |
| Health check | https://api-production-2318d.up.railway.app/health |
