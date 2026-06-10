# E2E FIXLOG — jurnal de lucru 0.6

> **Scop:** evidență DOAR pentru aducerea suitei E2E la verde (etapa 0.6). Ce schimb, unde, și de ce —
> ca să nu intrăm în cerc (să reparăm de două ori același lucru sau să stricăm un fix anterior).
> **Temporar:** când 0.6 e gata (suită verde) → mutăm rezumatul în `docs/CHANGELOG.md` și ȘTERGEM acest fișier.
> Nu ține loc de CHANGELOG (livrat) sau BACKLOG (de făcut) — e doar registru de lucru E2E.

---

## Baseline — rulare 2026-06-10 (`.\scripts\e2e.ps1 -ResetDb`)
**`15 passed · 36 failed` (7.9m).** Zgomotul din `e2e-results.txt` (`[WebServer]` hydration/eval) = noise Next dev, NU eșecuri.

Cele 36 reale = **4 grupuri**:

| Grup | Teste | Simptom | Cauză probabilă | Status |
|------|------:|---------|-----------------|:------:|
| **1 — login user → `/subscribe`** | ~20 | helper login ajunge la `/login`→`/subscribe`, niciodată `/dashboard` | **CSP `connect-src 'self' https:` bloca `getSubscription`→`http://localhost:3001`** (cross-origin HTTP) → fail-closed → `/subscribe`. NU seed, NU entitlement. | ✅ FIX + verificat în browser |
| **2 — login admin → `/admin`** | 11 | `toHaveURL(/admin/dashboard)` eșuează; „secret greșit" nu arată eroare | admin login folosește tot `request()`→`:3001` → probabil același CSP block (Turnstile `110200` = doar widget, nu blochează — captcha NU e cerut în dev). De reconfirmat după re-run. | 🔁 probabil rezolvat de fix-ul 1 |
| **3a — forgot-password** | 2 | heading „email trimis" absent | `forgot-password` = `request()`→`:3001` → blocat de același CSP | ✅ FIX 1 (CSP) |
| **3b — register** | 2 | `getByText(/verifică/i)` absent | **Turnstile**: signup are widget OBLIGATORIU; cheia de prod (`0x4AAA...`) dă `110200` pe localhost → form blocat | ✅ FIX 2 (cheie test) + verificat |
| **4 — selector `Control`** | 2 | `settings.spec:80,108` — `getByRole('button',{name:/^Control$/i})` „lipsă" | NU era drift — butonul EXISTĂ (nume exact „Control"); era race CSP (testul căuta pe `/subscribe`) | ✅ FIX 1 (CSP) + verificat |

Listă completă a celor 36 (cu fișier:linie) → în `e2e-results.txt`, secțiunea finală de sumar.

---

## Modificări (append-only, cel mai recent jos)

<!-- format: ### YYYY-MM-DD — Grup N — titlu scurt
- **Cauză:** …
- **Fix:** fișier:linie — ce s-a schimbat
- **Țintă:** ce teste ar trebui să treacă acum
- **Verificat:** rulare userului (rezultat) / în așteptare
-->

### 2026-06-10 — Grup 1 (+ probabil 2, 3) — CSP bloca API-ul local
- **Cauză:** `apps/web/src/middleware.ts` `buildCsp()` avea `connect-src 'self' https:`. În dev API-ul e
  `http://localhost:3001` (cross-origin HTTP) — nu e nici `'self'`, nici `https:` → browserul bloca toate
  fetch-urile prin `request()` din `lib/api.ts` (getSubscription, register, forgot, etc.). Doar auth
  (login/logout/refresh) mergea, fiind same-origin proxat de `app/api/v1/auth/[action]/route.ts`. Dashboard
  layout-ul prindea eroarea la `getSubscription` → fail-closed → `/subscribe`. **NU era seed/entitlement.**
  Dovezi: backend reprodus pe curl (create-user/login/getSubscription/CORS toate 200); browser console:
  `Refused to connect ... violates CSP directive "connect-src 'self' https:"`.
- **Fix:** `middleware.ts:39` — `connect-src` dev-gated: adaugă `http://localhost:3001` DOAR când
  `NODE_ENV !== 'production'`. În prod CSP rămâne **byte-cu-byte** `connect-src 'self' https:` (API-ul prod
  e `https://api.waai.ro`, acoperit de `https:`). Zero impact prod.
- **Țintă:** Grup 1 (~20). Probabil și Grup 2 (admin login = `request()`) și Grup 3 (register/forgot = `request()`).
- **Verificat:** browser MCP — re-login `browser@example.com` → ajunge pe `/dashboard` (înainte `/subscribe`);
  zero erori CSP în consolă. Admin login → `/admin/dashboard` ✓. `/settings` → tab „Control" prezent ✓.

### 2026-06-10 — Grup 3b (register) — Turnstile pe localhost
- **Cauză:** `apps/web/src/components/Turnstile.tsx:5` — `SITE_KEY = NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '0x4AAAAAADewooMRYw6Vs-m_'`
  (cheie de PROD, legată de waai.ro). Pe localhost dă `110200` → widget-ul nu se încarcă → signup-ul
  blochează submit-ul („Verificarea anti-bot nu s-a încărcat încă"). Doar signup + login (login doar după
  3 eșecuri) au Turnstile; forgot-password NU (acela era CSP).
- **Fix:** `apps/web/.env.local` (NOU, gitignored) → `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`
  (cheie de TEST Cloudflare, trece pe orice domeniu). Backend-ul nu cere verificare în dev (fără `TURNSTILE_SECRET`).
  Prod folosește cheia reală din Vercel — `.env.local` nu ajunge în prod.
- **Țintă:** register (auth.spec:24, :71).
- **Verificat:** browser MCP — signup complet → heading „Verifică emailul" apare ✓.

**Rezumat: toate cele 4 grupuri rezolvate cu 2 schimbări (1 linie cod dev-gated + 1 env file).
Măsurare finală pe `.\scripts\e2e.ps1` (userul) → aștept rezultatul ca să marchez 0.6 gata.**
