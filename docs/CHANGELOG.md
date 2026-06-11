# Changelog — WhatsApp AI

Format bazat pe [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added (2026-06-11) — pârghii de tier: plafon produse, cap RAG, timer minim (Etapa 2.2a, pas 3)

Trei plafoane per tier (valori din `SUBSCRIPTION_PLAN.md §1`), toate fail-closed (legacy/`tier=null` → limita Pro):
- **Plafon produse** (`products.routes.ts`): Pro 100 / Max 1.000. Gate pe `POST /products` (≥ limită → 403 `TIER_REQUIRED`) și pe `POST /products/import` (existente + import > limită → 403). `productsRepository.countForUser()` nou.
- **Cap RAG** (`knowledge.service.ts`): Pro 500 / Max 2.000 fragmente. `MAX_USER_CHUNKS` (constantă fixă 2.000) înlocuit cu `ragChunkLimit(tier)` în `ingest`. Anti-DoS la parsing (`MAX_EXTRACTED_CHARS`) neschimbat.
- **Timer minim/tier** (`ai.routes.ts` PATCH `/settings`): Pro min 5 min / Max min 1 min. Sub minimul tier-ului → 400 `VALIDATION_ERROR` pe câmpul `timerMinutes`.
- **`entitlement`**: `productLimit` / `ragChunkLimit` / `minTimerMinutes` (+ constantele `PRODUCT_LIMIT` / `RAG_CHUNK_LIMIT` / `MIN_TIMER_MINUTES`).
- **Teste:** pure pentru cele 3 funcții (fail-closed) în `entitlement.tier.integration.test.ts`; integrare timer Pro→400 / Max→200 în `ai.integration.test.ts`. `tsc --noEmit` verde.
- **Email confirmare comandă (Max-only) — N/A:** feature-ul nu există în cod (nicio trimitere de email pe comenzi), deci nu există ce „gate-ui". Rămâne de construit Max-only când/dacă se implementează. **Cu asta 2.2a e completă** (vision + multi-serviciu = 2.2b, separat).

### Added (2026-06-11) — plafon AI lunar pe Pro (Etapa 2.2a, pas 2)

Planul Pro promite 1.200 răspunsuri AI/lună, Max nelimitat — dar backend-ul nu număra/oprea nimic. Adăugat plafonul, fail-closed pe cost:
- **Contor durabil nou `ai_usage`** (`user_id`, `period_month` 'YYYY-MM' ora RO, `count`; PK compus). Tabel **separat** de `conversation_messages` — acela se curăță la 50 mesaje/contact, deci nu putea fi sursă de adevăr pentru consumul lunar. Adăugat în `migration-statements.ts` + safety-net `app.ts` + schema test `global-setup.ts` + `schema.ts`.
- **`entitlement.monthlyAiLimit(tier)`** → `null` pentru Max (nelimitat), `PRO_MONTHLY_AI_LIMIT` (1.200) pentru Pro/legacy/null (fail-closed: doar 'max' explicit primește nelimitat).
- **Gate în `message.handler.sendAiResponse`** (același choke point unic ca entitlement-ul, acoperă răspuns imediat ȘI programat): citește tier-ul; dacă e plafonat și consumul lunar ≥ limită → **nu generează** (zero apel LLM) + notifică owner-ul pe WhatsApp o singură dată/30min („ai atins plafonul, treci pe Max"). Altfel incrementează atomic (upsert `ON CONFLICT … count+1`). Incrementăm o dată per răspuns declanșat (debounce-ul colapsează rafalele), nu per mesaj primit.
- **Repository:** `getMonthlyAiUsage` / `incrementMonthlyAiUsage` (upsert atomic — corect și la concurență/multi-instanță) + helper exportat `aiUsagePeriod()`.
- **Teste:** `monthlyAiLimit` (pur, 3 cazuri) în `entitlement.tier.integration.test.ts`; nou `ai.usage.integration.test.ts` — `aiUsagePeriod` format + contor (get/increment atomic, izolare pe lună și pe user). `tsc --noEmit` verde.
- *Rămas din 2.2a (amânat, pas 3): plafon produse, cap RAG, email/vision doar Max.*

### Added (2026-06-11) — gating pe tier: rute Max-only enforce-uite în backend (Etapa 2.2a, pas 1)

Cardurile de abonament promit matricea Pro vs Max (vision/email/lead-scoring doar Max), dar backend-ul nu diferenția încă tier-ul → un client pe Pro primea tehnic și features Max. Închis gap-ul pe rute:
- **Middleware nou `requireTier('max')`** (`apps/api/src/middleware/requireTier.ts`): factory de autorizare pe TIER, fail-closed (tier necunoscut / fără abonament → rang 0 → refuzat). Citește `userTier()` din `billing/entitlement.ts`; rang `pro=1 < max=2`. Se pune **după** `authenticate` + `requireActiveSubscription` (entitlement-ul e verificat acolo; aici doar nivelul).
- **Eroare nouă `Errors.tierRequired()`** → `403 TIER_REQUIRED` (distinctă de `402 SUBSCRIPTION_REQUIRED`): userul ARE abonament valid, doar nu tier-ul cerut → clientul o mapează la „upgrade la Max", nu la „abonează-te".
- **Rute gate-uite Max-only** (`ai.routes.ts`): `GET /ai/stats/advanced` (statistici avansate) și `POST /ai/leads/analyze` (scoring AI lead-uri). `GET /ai/leads` (lista simplă) rămâne Pro+.
- **Teste** (`ai.integration.test.ts`): helper `registerAndLogin(email, tier='max')` threadează tier prin `seedActiveSubscription`; cazuri noi Pro→403 (`TIER_REQUIRED`) pe ambele rute + Max→200 pe `/stats/advanced`. `tsc --noEmit` verde.
- *Rămas din 2.2a (amânat): plafon AI 1.200/lună pe Pro + restul pârghiilor (plafon produse, cap RAG, email/vision).*

### Security (2026-06-11) — fail-fast dacă E2E_MODE=true în producție

`E2E_MODE=true` dezactivează rate-limit-urile (global + admin) și e gândit strict pentru E2E local. Setat din greșeală pe prod, ar slăbi **tăcut** apărarea anti brute-force. Adăugat guard în `apps/api/src/config/env.ts`: la `NODE_ENV === 'production' && E2E_MODE === 'true'` procesul scrie un mesaj FATAL și face `process.exit(1)` → greșeala de ops devine boot eșuat vizibil, nu o slăbire silențioasă. Combinația nu are nicio utilizare legitimă. Nicio cale atacabilă schimbată (toate flag-urile sunt server-side). Verificat: `tsc --noEmit` verde. Închide ultimul caveat operațional din auditul gating-ului test↔prod (rutele de test rămân apărate pe 5 straturi).

### Fixed (2026-06-11) — 0.6 E2E: suită verde (51/51), ultimele 7 eșecuri reparate

După repararea mediului (2026-06-10) + CSP/Turnstile, rularea era `44 passed · 7 failed`. Triaj: 5 cauze, aproape toate pe partea de teste (selectori/timing), o singură corecție de cod sursă. Rezultat final: **51 passed · 0 failed**.
- **API — gating E2E (`admin.routes.ts`):** `POST /admin/auth` avea rate-limit hard-codat `max:10/15min` **nedezactivat** în E2E (spre deosebire de restul rutelor admin) → suita (zeci de login-uri) lovea 429 la al 11-lea și pica pe `/admin`. Trecut prin helper-ul `rl()` → dezactivat în test/E2E, **prod neschimbat** (protecția anti brute-force pe codul admin rămâne intactă).
- **E2E admin (`admin.spec`):** assert pe butonul „Salvat!" prin rol, nu `getByText(/salvat/i)` (care prindea și „Nicio configurare salvată" → strict mode).
- **E2E dashboard (`dashboard.spec`):** `.first()` pe „Conectare WhatsApp" (apare în 2 locuri); testul de activare toggle AI așteaptă întâi „Inactiv" (încărcare completă) înainte de click — cursă de timing, aliniat cu testul-frate de dezactivare.
- **E2E settings (`settings.spec`):** `addInitScript` sădește consimțământul cookie în `beforeEach` → `CookieBanner` (`fixed bottom-0 z-50`) nu mai acoperă butonul „Șterge" din blacklist.
- **E2E auth (`auth.spec`):** `waitForTurnstile()` așteaptă tokenul (cheia de test `1x…AA` populează `cf-turnstile-response`) înainte de submit — altfel `/signup` făcea `return` devreme (token gol) și înregistrarea nu se trimitea.
- **Follow-up notat:** testele `email duplicat` / `parolă slabă` din `auth.spec` sunt verzi dar prind alerta anti-bot din return-ul devreme, nu comportamentul real (duplicat → 201 generic anti-enumerare). De rescris fidel separat (vezi BACKLOG).

### Added (2026-06-10) — tooling E2E local + fix mediu Playwright (parte din 0.6)

Suita E2E pica „din mediu, nu din cod". Cauze găsite și reparate în `apps/e2e/playwright.config.ts`:
- **`DATABASE_URL` pe `127.0.0.1:5432`** (era `localhost` → pe Windows rezolvă la IPv6 ::1 → connection timeout). Același fix în `helpers/api.ts`.
- **`reuseExistingServer: false`** (API + web): nu mai refolosește un `dev:api` pornit manual (care rulează FĂRĂ `E2E_MODE`/`E2E_SECRET`/DB e2e → rutele `/api/v1/test/*` lipsesc/dau 401).
- **`dashboard.spec` test navigare** rescris pe sidebar-ul fix de desktop (hamburger-ul „Deschide meniul" e `lg:hidden`, deci absent pe viewport-ul Desktop Chrome al Playwright).
- **Scripturi PowerShell noi** (`scripts/`): `stop-dev.ps1` (eliberează porturile 3000/3001), `db-reset-e2e.ps1` (recreează baza E2E curată, doar ea), `e2e.ps1` (stop dev → reset opțional → Playwright → `e2e-results.txt`).
- *Restul aducerii specs-urilor la zi (0.6) rămâne — se țintește pe eșecurile reale după prima rulare cu mediul reparat.*

### Security (2026-06-10) — 0.7: hardening login cu Turnstile după N eșecuri (anti account-lockout DoS)

Lockout-ul per-email (10 eșecuri/15min) bloca login-ul **și pentru owner-ul real** → un atacator care știe emailul victimei putea face DoS de login 15 min. Înlocuit cu **challenge Turnstile după 3 eșecuri** (varianta C, gold-standard):
- **Backend** (`auth.service.login`): când `TURNSTILE_SECRET` e setat (prod), la `attempts >= 3` cerem token Turnstile valid (verificat **înainte** de `findUserByEmail` → fără enumerare, aliniat M8); lipsă/invalid → eroare nouă `CAPTCHA_REQUIRED` (cod distinct de 401 generic, `utils/errors.ts`). Hard-lockout-ul la 10 **scos în prod** (dispare DoS-ul) și **păstrat ca fallback** când Turnstile nu e configurat (dev/test/E2E). `loginSchema` + `turnstileToken?` opțional.
- **Frontend** (`login/page.tsx`, `lib/api.ts`): flux **reactiv** — la `CAPTCHA_REQUIRED` afișăm widget-ul `<Turnstile>` (refolosit din register), butonul devine „verificare…" cât se rezolvă challenge-ul, apoi trimitem token-ul. Token single-use → remontăm widget-ul după fiecare încercare. Fără endpoint de probe → zero leak de enumerare.
- Brute-force-ul automat e oprit de challenge + rate-limit per-IP; omul real nu e blocat niciodată (rezolvă challenge-ul, de regulă invizibil în mod managed).
- Teste: 2 cazuri noi în `auth.integration.test.ts` (mock `verifyTurnstile`, `env.TURNSTILE_SECRET` activat doar pe blocul respectiv) — după 3 eșecuri parola corectă e gated fără token (dovedește anti-DoS), token valid deblochează, token invalid → `CAPTCHA_REQUIRED`. Verificat: API tsc, web eslint/tsc/build verzi.

### Fixed (2026-06-10) — `setErrorHandler` ocolit pe TOT API-ul (envelope-ul de eroare nu se aplica)

Bug latent prins la rularea testelor 0.7 (cele 2 cazuri captcha picau cu `error.code === undefined` deși statusul era corect 401). Cauză în `apps/api/src/app.ts`: `app.setErrorHandler(...)` era apelat **după** `await app.register(...rute...)`. Cu `await` pe fiecare `register`, fiecare plugin de rută se boot-ează pe loc și **moștenește error handler-ul existent atunci** — adică cel **default** al lui Fastify. Efect pe întreg API-ul: erorile ieșeau în forma plată `{statusCode, code, error, message}` în loc de envelope-ul nostru `{error:{code, message}}`. Toate testele de până acum verificau doar `statusCode` (corect din `error.statusCode`), deci bug-ul a trecut neobservat; cele 2 teste captcha au fost primele care asertează `error.code`.
- **Fix:** `setErrorHandler` mutat **înainte** de orice `register` (pattern-ul documentat Fastify: handler întâi, apoi rute) → toate rutele moștenesc envelope-ul corect.
- **Bonus securitate (anti-info-leak):** înainte, erorile necontrolate (500) ieșeau prin serializatorul default Fastify, care trimite **mesajul real al erorii** în răspuns; acum trec prin handler-ul nostru care maschează (`INTERNAL_ERROR` / „An unexpected error occurred."). Mai puțin leak, nu mai mult.
- **Impact / compat:** schimbă forma erorii pe TOT API-ul (plată → nested). Singurul consumator e frontend-ul, care tratează deja ambele forme defensiv (`lib/api.ts`) — fără regresie.
- Verificat: suită API completă **287/287 verde** (auth captcha incl.), forma envelope confirmată nested prin log de diagnostic temporar (scos după).

### Security (2026-06-10) — mini-audit pe schimbarea de envelope erori → 0 crit/high (F1/F2/F3 reparate)

Audit țintit pe blast radius-ul fix-ului de mai sus (acum handler-ul prinde TOATE erorile rutelor; înainte le servea default-ul Fastify). Verdict: net pozitiv pe securitate (500 nu mai scurge `message`/stack; envelope consistent cu răspunsurile manuale din `ai.routes.ts`). 3 regresii funcționale reparate, F4/F5 → reziduuri acceptate în BACKLOG.
- **F1 (mediu, funcțional):** `ai.service.ts` arunca `throw new Error(<mesaj util>)` pe „minim 5 mesaje" (analyze-style) și „fără conversație" (analyze-lead) — mesaje care înainte ajungeau la user prin 500-ul leaky, acum mascate. Convertite în `Errors.unprocessable()` (**422 `UNPROCESSABLE`**) → mesaj livrat intenționat. + 2 teste.
- **F2 (low):** erorile Fastify-interne cu status de client (JSON malformat 400, bodyLimit 413, media-type 415, rate-limit 429) cădeau pe 500. Handler-ul păstrează acum statusul nativ în [400,500), normalizat în envelope; doar 5xx rămân mascate. (Ramura 429 dedicată devenită redundantă — scoasă.)
- **F3 (low):** lipsea `setNotFoundHandler` → 404-urile ieșeau pe forma plată default. Adăugat handler dedicat → `{error:{code:'NOT_FOUND'}}`, consistent cu restul. + 1 test.
- Verificat: `tsc --noEmit` verde. Teste noi: 2× `ai.integration.test.ts` (422), 1× `app.integration.test.ts` (404). Suită completă de rulat de owner.

### Changed (2026-06-10) — 0.5: curățenie reguli „React Compiler" (eslint-plugin-react-hooks v6) → pe `error`

Cele 20 de findings din 13 fișiere `apps/web` (intrate cu eslint-config-next 16) rezolvate; cele 4 reguli (`set-state-in-effect`, `purity`, `refs`, `immutability`) readuse de pe `warn` pe **`error`** (orice regresie sparge build-ul). Abordare hibridă — refactor real unde fix-ul era curat, `eslint-disable` documentat unde efectul e pattern-ul SSR-corect:
- **`refs` (2, `Turnstile`):** atribuirea `cbToken/cbExpire.current` mutată din render într-un efect fără deps (pattern latest-callback corect).
- **`purity` (4, `dashboard`+`admin`):** `Date.now()` în render → capturat o dată la mount cu `useState(() => Date.now())` (lazy init).
- **`immutability` (1, `subscribe`):** `window.location.href = url` → `window.location.assign(url)`.
- **`set-state-in-effect` — refactor curat (6):** temă (`ThemeToggle` + landing `useTheme`) mutată într-un hook partajat nou `lib/useTheme.ts` cu **`useSyncExternalStore`** (server snapshot `false` + MutationObserver pe clasa `dark` → fără hydration mismatch); `verify-email` (stare inițială derivată din token); `login` (params din `useSearchParams` + graniță `Suspense` în loc de citire `window` în efect); `dashboard` (flag checkout lazy-init din param); `layout` (închidere drawer pe schimbare rută via pattern „ajustează state în render", nu efect).
- **`set-state-in-effect` — `eslint-disable` documentat (7):** citiri browser-only la mount unde efectul evită hydration mismatch (`CookieBanner`/`dashboard` trial-popup → localStorage; `settings` → hash URL; `admin` → sessionStorage); fetch-on-mount unde setState e DUPĂ `await` dar regula flaghează conservativ funcția apelată (`conversations`, `leads`); efectul de auth-gate din `layout` (setState lifecycle, block-scoped disable).

Verificat: `eslint src` curat (0), `tsc --noEmit` curat, `next build` verde. Zero schimbare de comportament vizibil (temă/cookie/login/tab-uri identice).

### Fixed (2026-06-10) — 0.2: statistici greșite cu 1h pe zilele de tranziție DST

Debugging activ (Etapa 0.2). `startOfDayInTz`/`startOfMonthInTz` (`ai.repository.ts`, folosite de `getStats`) luau offset-ul de fus la `now`, nu la miezul nopții candidat → pe cele 2 zile de schimbare a orei/an, granița „azi/săptămână/lună" ieșea cu ±1h (ex. spring-forward 2026-03-29: 28T21:00Z în loc de 28T22:00Z). Fix: offset calculat la instanța candidat (miezul nopții / prima zi a lunii) — dovedit prin execuție (diff=0 pe toate zilele). Helpere exportate + test nou `stats.tz.test.ts` (4 zile + 2 luni, inclusiv tranzițiile). Impact era LOW (statistici aproximative dashboard, nu bani/securitate). `parseLeadClassification` verificat — curat (deja excelent acoperit).

### Fixed (2026-06-10) — 0.2: gatekeeper / import CSV / comenzi owner (4 defecte găsite prin execuție)

Debugging activ (Etapa 0.2), dovedit prin scripturi standalone pe funcțiile reale:
- **Import CSV — preț cu separator de mii** (`apps/web/src/lib/csv.ts`): `"1.299,00"` se parsa ca `1.299`, `"2.500 lei"` ca `2.5` (`.replace(',','.')` doar prima virgulă → `parseFloat` se oprea la al 2-lea punct). Helper nou `parsePriceLei`: zecimala = ULTIMUL separator, celălalt = mii → `"1.299,00"→1299`, `"1,299.00"→1299`, `"49,99"→49.99`. (Un singur separator cu 3 cifre, ex. `"2.500"`, rămâne ambiguu — preview-ul de import îl arată.)
- **Import CSV — newline în câmp citat** (`parseCsv`): rescris ca mașină de stări pe tot textul (nu mai face `split('\n')` înainte de parsarea ghilimelelor) → câmpurile citate pot conține virgule ȘI newline-uri interne, cum promitea comentariul.
- **Gatekeeper `classifyBusinessScope`** (`message.handler.ts`): keyword-ul „vremea" era prea generic și bloca mesaje legitime („vremea de execuție/livrare") ca `off_topic`. Înlocuit cu fraze meteo specifice („cum e/va fi vremea", „ce vreme", „prognoza meteo").
- **Comandă owner `/pauseAI`** (`command.parser.ts`): fără plafon (`/pauseAI 99999h` oprea agentul ~11 ani; `0h` = no-op tăcut). Plafon 1–720h + acceptă „5" fără „h".
- Teste de regresie: `command.parser.test.ts` (pauseAI) + `message.handler.test.ts` (vremea). NOTĂ: `csv.ts` e în `apps/web`, care NU are runner de unit-teste (vitest) → fix-urile A/B sunt verificate prin execuție, nu prin suită.

### Fixed (2026-06-10) — 0.2: `parseOrderIntent` lăsa o linie cu cantitate 0 (floor după filtru)

Debugging activ prin execuție (Etapa 0.2, calea banilor). O cantitate în intervalul `(0,1)` (ex. `0.4`) trecea de filtrul `quantity > 0` (verificat pe valoarea brută) și abia apoi `Math.floor` o făcea `0` → rămânea o linie „produs ×0" într-o comandă `ready`. Fix: floor ÎNAINTE de filtru (`floor` apoi aruncă `<= 0`), deci `0.4→aruncat`, `1.9→1`, `-3→aruncat`. Impact era LOW (totalul rămânea corect — `0×preț`; `decrementStock(0)` inofensiv), dar plasa de validare strictă trebuia să-l prindă. + 2 cazuri de regresie în `order.intent.test.ts`. (Observație necorectată: id duplicat în `items` → linii separate fără dedup — de evaluat la o iterație viitoare.)

### Security (2026-06-10) — 0.1b: exploatare LIVE pe prod (`api.waai.ro`) → APPROVED (0 crit / 0 high)

Pentest autorizat live, scripturi `pentest/` (gitignored). **Faza anonimă** (`recon.py`): 37 PASS, 0 crit/high/med — rute protejate→401, rute test→404 (excluse din build), **Stripe webhook** no-sig/fake-sig→400 (raw buffer parser ține post-Fastify 5), **JWT forjat** (alg=none/garbage)→401 (fără alg-confusion live), **CORS** origine atacator→403 ne-reflectat / legit→204, headere (HSTS/nosniff/X-Frame) prezente, bodyLimit (1MB→413), DELETE ne-blocat de WAF. **Faza autentificată** (`attack.py`, 2 conturi entitled): 16 PASS, 0 crit/high/med — gate abonament C1/C2 (200 pe entitled), date scoped pe userId, **IDOR/BOLA live** (user B încearcă DELETE+PATCH pe produsul lui A → 404, produs supraviețuiește neschimbat, verificat prin re-listare), refuz admin (401, schemă de sesiune separată), DELETE /me inexistent (double opt-in by-design). **4 LOW** informaționale (admin 401-vs-403; DELETE /me 404 by-design). **Verdict APPROVED — suprafața B13 ține și la atac real pe prod.** Nou item BACKLOG 0.7 (LOW): hardening login cu CAPTCHA-după-N-eșecuri (anti account-lockout DoS pe lockout-ul per-email).

### Security (2026-06-10) — 0.1a: review static adversarial post-upgrade B13 → APPROVED (0 crit / 0 high)

Review DRASTIC pe suprafața schimbată de upgrade (NU audit de la zero pe logica aprobată 08-06). Verificat pe fiecare axă: body parser JSON Fastify 5 (delegă la `getDefaultJsonParser('error','error')` → protecție anti proto/constructor-poisoning păstrată); Stripe webhook raw `buffer` izolat în scope `/webhooks` + semnătură pe raw + dedup `stripe_events`; CORS/rate-limit/trustProxy Fastify 5 (`methods` explicit vs default v11 strâns, hops fix, key pe `CF-Connecting-IP`); CSP nonce Next 16 (per-request, `strict-dynamic`, fără `'unsafe-inline'` în `script-src`); proxy `[action]` Next 16 (`params` await-uit, `action` allowlistat → fără SSRF); scheme zod 4 (`safeParse`+`.issues`); JWT HMAC fix (fără alg-confusion, constant-time) + CSRF `assertTrustedOrigin`; 2FA admin otplib 13 migrat corect (`verify({…epochTolerance})→{valid}`, fail-closed). **Verdict APPROVED.** 2 note LOW pre-existente (ne din B13): handlere admin cu `req.params/body as` brut (query-uri parametrizate downstream, scope admin); `login` fără `assertTrustedOrigin` (CSRF login = impact mic).

### Changed (2026-06-09) — B13: upgrade major de pachete (Fastify 5, Next 16, React 19, Tailwind 4, ESLint 9, zod 4, Drizzle 0.45)

Upgrade pe clustere izolate (un major pe branch → `tsc`+lint local → suită rulată de owner → preview → merge squash). Lecție de proces: branch-urile stivuite produc conflicte pe `pnpm-lock.yaml` → fiecare branch se ramifică de pe `main` proaspăt.

**Backend:**
- **Cluster 0** — `stripe` 22.1→22.2 (+`apiVersion 2026-05-27.dahlia`), `vitest`+`@vitest/coverage-v8`→4.1.8, `tsx`→4.22.4, scos `@types/node-cache`.
- **Cluster 1** — `uuid` SCOS complet (→`crypto.randomUUID()` în `auth.service`/`billing.service`), `bcryptjs` 2→3 (hash-uri `$2b$` compatibile, zero cod), `dotenv` 16→17.
- **Cluster 2** — `resend` 3→6 (`^6.12.4`), zero cod (folosim doar `html`, nu `react`).
- **Cluster 3** — `zod` 3→4 (`^4.4.3`): breaking real `ZodError.errors`→`.issues` reparat în 7 rute + `parseBody` (`auth.controller`) rescris pe tipul real `ZodType<T>`. `.email()/.url()/.uuid()/message:` deprecate dar funcționale (nemigrate, diff mic).
- **Cluster 4** — `drizzle-orm` 0.30→0.45 (`^0.45.2`), ZERO cod (folosit doar ca query builder: `sql/eq/and`, `pg-core`, `node-postgres`; fără RQB/`relations()`, fără `drizzle-kit` — migrările = SQL brut).
- **Cluster 5** — `fastify` 4→5 (`^5.8.5`) + plugin-urile @fastify (`cookie`→11, `cors`→11, `helmet`→13, `multipart`→10, `rate-limit`→10). Cod: `setErrorHandler` tipat explicit (`FastifyError`). OPS: `"engines":{"node":">=20"}` în `package.json` rădăcină. Post-deploy au apărut 2 regresii (reparate, vezi „Fixed 2026-06-09 — DELETE/Fastify 5" mai jos).

**Frontend (apps/web):**
- **web-1** — `lucide-react` 0.378→1.17 (zero cod; niciuna din cele 42 icoane folosite nu e brand).
- **web-2** — `zustand` 4→5 (`^5.0.14`), zero cod (`import { create }`, fără `shallow`, `persist` standard).
- **web-3 + web-4** (merge împreună — combinația React19+Next14 e nesuportată) — `react`+`react-dom` 18→19 (`^19.2.7`, `@types/react`+`dom`→19) + `next` 14→16 (`16.2.7`). Fixuri: `useRef(undefined)` (types 19), `layout.tsx` `async`+`await headers()`, `auth/[action]/route` params `Promise`+await, `BackButton` eslint-disable țintit. `next build` (Turbopack) verde. `next lint` ELIMINAT în Next 16.
- **web-5** — `tailwindcss` 3→4 (`^4.3.0`) via `npx @tailwindcss/upgrade`: `globals.css`→`@import 'tailwindcss'`+`@custom-variant dark`+`@theme{}` (token-uri mapate), `@tailwindcss/postcss`, `tailwind.config.ts` ȘTERS (config în CSS); 16 fișiere template redenumiri (`outline-none`→`outline-hidden` etc.). ⚠️ v4 cere Safari 16.4+/Chrome 111+.
- **web-6** — `eslint` 8→9 (`^9`, flat config) + `eslint-config-next` 15.5.19→16.2.7. `.eslintrc.json` ȘTERS → `eslint.config.mjs` (exporturi native flat `eslint-config-next/core-web-vitals`+`/typescript`, fără FlatCompat); script `lint`: `--ext`→`eslint src`. eslint 10 blocat de peer-urile plugin-urilor (`<=9`). Reguli noi „React Compiler" (`eslint-plugin-react-hooks` v6): 20 findings lăsate pe `warn` → curățenie în `BACKLOG.md` B13.1.

**Colateral web:** `@vercel/speed-insights@^2` adăugat în `layout.tsx`. **DEFER:** `@whiskeysockets/baileys` 6→7 (încă RC), `typescript` 5→6 (beneficiu mic) — `BACKLOG.md` B13.

### Fixed (2026-06-09) — DELETE-uri în prod după Fastify 5 (CORS + body gol) + latență + hydration #418

- **Toate DELETE-urile (ștergere user admin/produs/blacklist, clear conversație, disconnect-wa) picau în prod** după cluster-5. Două cauze suprapuse: (1) `@fastify/cors` v11 a strâns default-ul `methods` la `GET,HEAD,POST` → preflight respingea DELETE/PUT/PATCH → `app.ts` declară explicit `methods: ['GET','HEAD','POST','PUT','PATCH','DELETE']`; (2) **cauza reală mascată** — Fastify 5 respinge cu 400 `FST_ERR_CTP_EMPTY_JSON_BODY` orice cerere cu `content-type: application/json` și body gol (clientul trimite Content-Type pe DELETE-uri fără body). Fix: parser custom `application/json` în `app.ts` (body gol → `undefined`, restul prin `getDefaultJsonParser` securizat). ⚠️ Gotcha: `addContentTypeParser` aruncă `FST_ERR_CTP_ALREADY_PRESENT` peste parser-ul existent → `removeContentTypeParser` întâi; idem în `stripe.webhook.ts` (scope încapsulat moștenește parser-ul de la root → și acolo `removeContentTypeParser` înainte de parser-ul buffer). `tsc` verde + repro standalone.
- **„Lent peste tot, mereu" (frontend)**: funcțiile Vercel rulau în US East (`iad1`) deși userii + API-ul (Railway `europe-west4`) sunt în Europa → fiecare randare dinamică = drum transatlantic. Fix: regiunea funcțiilor mutată în Frankfurt (`fra1`) din dashboard Vercel. Confirmat live `X-Vercel-Id: fra1::fra1`.
- **React hydration error #418 + emailuri afișate `[email protected]`**: cauza = **Cloudflare Email Obfuscation** (Scrape Shield) rescria `support@waai.ro` în HTML în tranzit → HTML livrat ≠ ce randa React (mismatch text), iar `email-decode.min.js` era blocat de CSP. Fix: dezactivat Email Address Obfuscation în Cloudflare (nu e cod). Confirmat live: HTML fără `__cf_email__`, consolă 0 erori.

### Removed (2026-06-09) — Email confirmare comandă către client (securitate L9 + branding)

- **Scos** emailul automat de confirmare comandă către client din `message.handler.ts` (+ `sendOrderConfirmationEmail`/`OrderEmailSummary` din `utils/email.ts`, plus codul mort aferent: `extractEmail`, throttle `lastOrderEmail`, `emailNote`, importurile `z`/email).
- **De ce**: (1) venea de la `noreply@waai.ro` — nebrandat și confuz pentru clientul altui business (a comandat de la „Auto Service X", primea mail „de la waai."); (2) era vectorul **L9** (cineva putea tasta în chat emailul unei victime → confirmarea ajungea acolo, throttle 10min). WhatsApp confirmă oricum comanda din numărul businessului. Decizie de produs: platforma nu trebuie să fie expeditor în relația owner↔client.
- **Constatare conexă**: domeniul `waai.ro` e **Verified** în Resend (nu sandbox, cum zicea nota veche N3) → emailurile tranzacționale rămase (verificare cont, resetare parolă, ștergere cont, notificări admin) livrează corect.
- **Viitor**: confirmări pe email branduite pe business, trimise din contul owner-ului (SMTP) și declanșate explicit din dashboard — `BACKLOG.md` B14. `tsc` verde.

### Fixed (2026-06-09) — Agent nu mai pretinde un handoff inexistent (CB7)

- **Problema** (test service auto): clientul cerea o programare („revizie") + comandă piese; niciuna nu se crea (corect — „Revizie" nu era produs rezervabil în catalog, iar piesele n-au fost identificate), DAR agentul promitea fals „am anunțat echipa și vă confirmă". `honestyGuard` interzicea deja asta, însă modelul îl încălca în context de programare/comandă neterminată.
- **Fix**: notele de fază `collecting` din `message.handler.ts` (booking `:437`, order `:630`) reafirmă acum explicit „încă NU ai înregistrat nicio programare/comandă și NU ai anunțat proprietarul sau vreun coleg — nu spune că ai făcut-o; spune sincer că aduni detaliile și proprietarul revine". LLM-steering (probabilistic, aliniat cu `honestyGuard`), `tsc` verde.
- **Cauza programării = conținut, nu cod**: „revizie" e termen-umbrelă colocvial (= schimb ulei + filtre); `analyzeBookingIntent` primește doar serviciile rezervabile + `orderIntakePrompt` (nu Knowledge Base) și are regula „nu inventa servicii". Rezolvare în dashboard: adăugare „Revizie" ca produs rezervabil-pachet **sau** mapare în `orderIntakePrompt`. Vezi `BACKLOG.md` CB7.

### Added (2026-06-08) — Multi-serviciu, date livrare, red-flag alerts, furnizor LLM + fixuri conversație

- **B10 — Programări multi-serviciu**: `BookingIntent.serviceId` → `serviceIds[]` (compat cu `serviceId` string vechi; dedup, max 10). Tabel nou **`appointment_items`** (FK cascade la appointment, product_id, service_name, unit_price_bani) + `appointments.total_bani`. Fluxul de booking propune toate serviciile cerute pentru aceeași programare („A + B"), total calculat în cod, creează liniile, notifică owner-ul cu servicii + total. Anti-dublură pe **mulțimea** de servicii (set sortat) + slot. Dashboard `/appointments` afișează liniile + total (fallback la `serviceName` pt programări vechi).
- **B11 — Date livrare structurate**: `OrderIntent.delivery {method:'pickup'|'delivery'|'', address}` (validat la listă închisă). Coloane noi `orders.delivery_method/delivery_address`. Notificarea owner = structurată AWB-ready (👤nume 📞telefon 🚚metodă 📍adresă 📝detalii). Dashboard orders afișează blocul de livrare. Alternativă ieftină la integrarea de curierat (V8 = decis NU acum).
- **B1 — Red-flag alerts** (prompt platformă INTACT): `detectRedFlags(text)` determinist (diacritic-insensitive + compact) — reclamație, rambursare, avocat/instanță, ANPC/ANAF, GDPR, fraudă. La detecție: alertă owner pe WhatsApp (throttle 30min) + `redFlagNote` în prompt (răspunde calm, fără promisiuni/consultanță juridică, anunță owner). `redFlagNote` = doar etichete statice (fără text client în prompt).
- **B5 — Afișare furnizor LLM**: `getActiveLLMProvider()` (sursă unică din env), endpoint `GET /ai/llm-provider` (autenticat + abonament), inclus în `/admin/stats`. UI: indicator în Setări→Agent + card în Admin.
- **Fixuri conversație (CB1-3)**: (1) salut nu mai e clasificat ca rămas-bun („Vă salut" → nu mai răspunde „La revedere") — regulă mereu injectată „salut = deschidere". (2) Nota de colectare booking nu mai re-enumeră hardcodat câmpurile la fiecare tură (bătea istoricul) → folosește doar `missingInfo` real + guard anti-re-ask în ambele note (booking + order). (3) `classifyScopeLLM` nu mai marchează „ce rol aveți?" ca INJECTION (definiție restrânsă la manipulare reală + carve-out întrebări despre asistent = BUSINESS); `businessScopeReply` mascat (deviere naturală, fără „Nu pot schimba rolul conversației").
- **Email**: redesign template Resend (`utils/email.ts`) — header dark gradient, badge, card, footer cu linkuri, param `preheader`. Toate valorile user trec prin `escapeHtml` (probă XSS dură trecută).
- **UI**: editare produs inline în `/products` (formularul apare la rândul editat, nu mereu sus); fixuri `emailVerified` în răspunsul de login, ștergere `systemPrompt` (fallback pe DEFAULT_PROMPT), tab Setări persistat în hash URL.

### Security (2026-06-08) — Audit integral rute: APROBAT, 0 CRITIC/HIGH

- Audit complet (60+ rute): toate publicele justificate, IDOR/BOLA închis (scoping `userId` + `id` pe read/update/delete), gating abonament consecvent, preț în cod nu în LLM. 3 findings minore rezolvate: **M-1** `admin.routes.ts` — 2 rute admin fără Zod → scheme stricte; **L-2** `verifyAdminToken` mutat din corpul handler-ului în `preHandler` `adminGuard` pe toate rutele (`/auth` rămâne public); **L-1** `GET /ai/llm-provider` primit `requireActiveSubscription` (consecvență cu `/ai/*`).
- Reziduuri ACCEPTATE declarate (nu se renumără): prompt-injection strat 2 fail-open, deps majore Fastify5/Next15, alerting runtime, `bodyLimit` edge, L5/L6/L9/L12 — toate în `BACKLOG.md` B8.

### Added (2026-06-07) — 2FA (TOTP) pe login-ul admin

- **De ce**: panoul `/admin` era protejat cu un singur factor (`ADMIN_SECRET`). Filtrele de rețea (IP allowlist, Cloudflare Zero Trust) au fost respinse — Zero Trust cere plan plătit, iar IP allowlist e inutil pentru un operator mobil care se loghează din locuri diferite. Soluția corectă = autentificare care „călătorește cu operatorul": 2FA cu TOTP.
- **Backend**: `POST /admin/auth` acceptă acum `{ secret, totp }`. 2FA e activă **doar dacă** `ADMIN_TOTP_SECRET` (base32) e setat — altfel sărită (dev/test/back-compat, ca pattern-ul Turnstile). Verificare cu `otplib` (`verify`, toleranță `epochTolerance: 30s` la decalaj de ceas). Secretul greșit e respins **înainte** de verificarea TOTP. Rate-limit existent (10/15min) acoperă și brute-force pe codul de 6 cifre.
- **Script nou** `apps/api/src/scripts/gen-admin-totp.ts`: generează secretul TOTP + `otpauth://` URI (rulat o dată local; secretul ajunge în Railway). Zero dependențe în plus pentru rendering (introducere manuală în authenticator sau scanare URI).
- **Frontend** (`apps/web/.../admin/page.tsx`): câmp „cod 2FA (dacă e activat)", `inputMode="numeric"`, trimis doar dacă e completat.
- **Fără terț / fără cost**: TOTP e standard deschis (RFC 6238); `otplib` rulează local, aplicația authenticator (Google Authenticator/Authy) e gratuită. Fără SMS, fără serviciu extern.
- **Recovery**: prin design fără cod de recuperare (decizie operator) — regenerezi secretul cu scriptul + actualizezi în Railway; lockout imposibil. Vezi `RUNBOOK.md §9`.
- **Teste**: +4 teste integration 2FA în `admin.integration.test.ts` (fără cod→401, cod greșit→401, cod valid→200, secret greșit→401 înainte de 2FA). **44/44 verde** pe modulul admin. `tsc` + `next lint` curate.
- **Dependență nouă**: `otplib ^13.4.1` (API funcțional). Doc: `ENV_VARS.md` (`ADMIN_TOTP_SECRET`), `SECURITY.md`, `RUNBOOK.md §9`.

### Changed (2026-06-06) — Ștergere cont prin confirmare pe email + deconectare WhatsApp

- **Flux nou (double opt-in)**: ștergerea contului nu mai e instant. `DELETE /users/me` a fost înlocuit cu doi pași: `POST /users/me/deletion-request` (autentificat, cere parola → generează token, trimite email cu link de confirmare) + `POST /users/me/deletion-confirm` (fără auth — token-ul e dovada → șterge definitiv). Token hash HMAC-SHA256 în `deletion_token`, raw doar în email, expiry 1h, single-use.
- **De ce**: ștergerea imediată era periculoasă cu un access token furat (ireversibilă pe loc). Confirmarea prin email blochează scenariul — atacatorul nu finalizează fără acces la emailul victimei.
- **Deconectare WhatsApp la ștergere**: `deletion-confirm` apelează `disconnectSession(userId)` înainte de ștergere → închide socket-ul Baileys din memorie + curăță auth state, evitând o sesiune orfană. Cascade-ul FK șterge restul (produse, comenzi, conversații, knowledge, leads, abonament, refresh tokens).
- **Frontend**: buton „Șterge contul" mutat/expus în pagina de **Profil** (zonă periculoasă) → „verifică-ți emailul"; pagină nouă `/sterge-cont` confirmă cu token-ul → logout.
- **Curățenie**: conceptul `deletion_scheduled_at` (vechiul soft-delete 48h) scos complet din cod (schema, middleware, `auth.service`, migrări, setup teste) + cron-ul orar de purge. Coloana rămâne orfană în DB prod (fără DROP).
- **Email liber la re-înregistrare**: ștergerea radează și emailul → userul poate reveni; anti-trial-abuse mutat pe Stripe Radar (card), nu pe email.
- **Teste**: `users.integration.test.ts` rescris (deletion-request + deletion-confirm, token single-use). Suită API verde **262/262**.

### Fixed (2026-06-06) — BOLA `DELETE /products/:id` returna 204 silențios

- `DELETE /api/v1/products/:id` returna mereu `204` chiar când nu ștergea nimic (produs inexistent / al altui owner) → un oracol de existență a resurselor altui user. Fix: `productsRepository.remove` întoarce `rowCount`; ruta dă **404** când nu s-a șters nimic. WHERE rămâne scopat pe `userId` (BOLA era deja închis). IDOR/BOLA verificat **LIVE pe prod** (`pentest/attack.py --idor`): 0 CRIT.

### Added (2026-06-01) — Anti-spam la înregistrare (blocare email temporar + honeypot)

- **Problema**: pe `/register` (endpoint public) apăruseră conturi-spam create automat de un scanner/bot, cu emailuri de unică folosință (mailinator, guerrillamailblock, wshu.net) și nume „Pentest/Audit". Nu o breșă — abuz al formularului public; conturile erau neverificate/neplătite, dar zgomot.
- **Blocare email de unică folosință**: `utils/disposable-email.ts` (`isDisposableEmail`) cu listă de domenii throwaway; aplicat în `registerSchema` ca `.refine` pe email → eroare clară sub câmpul email. Ar fi blocat 100% din spam-ul observat.
- **Honeypot anti-bot**: câmp ascuns `website` în schema de înregistrare (`.max(0)`) + input ascuns vizual în pagina `/signup`. Oamenii îl lasă gol; boții care autocompletează câmpurile îl umplu → validarea pică.
- **Existau deja**: rate limit pe `/register` (5/10 min/IP) + verificare email obligatorie (cont creat `emailVerified: false`). Test unit `disposable-email.test.ts`. `tsc --noEmit` verde pe API + web.
- **Rămas opțional** (`BACKLOG.md`): CAPTCHA (Cloudflare Turnstile) ca strat suplimentar — necesită cont Cloudflare + chei.

### Added (2026-06-01) — Programări: servicii rezervabile (N1, handoff ușor)

- **Scop**: acoperă businessurile pe bază de rezervare (frizerie, clinică, salon), care nu „comandă produse" ci rezervă un interval. Axa „tip tranzacție", complementară prețului fix/estimativ.
- **Flag `products.isBookable`** (`schema.ts` + migrat în 3 locuri: `migration-statements.ts`, `app.ts`, `test/global-setup.ts`). Tabel nou **`appointments`** (id, public_ref `prg_xxx`, contact, status, service_name, requested_slot text, details). `appointments.repository.ts` + `appointments.routes.ts` (list / updateStatus + notificare client / delete), înregistrate pe `/api/v1/appointments`.
- **`analyzeBookingIntent` / `parseBookingIntent`** în `groq.client.ts`: LLM-ul clasifică faza (none/collecting/ready) și extrage serviciul + intervalul (text liber) + numele; codul validează (serviceId ∈ catalog, „ready" fără serviciu/interval → collecting).
- **`message.handler.ts`**: catalogul se împarte în servicii rezervabile (flux programări) și restul (flux comenzi). La „ready" → creează programare 'pending', răspunde clientului („proprietarul confirmă intervalul"), notifică owner-ul „📅 Programare nouă"; anti-dublură 12h pe contact+serviciu+interval. Marcaj `[REZERVABIL]` în catalogul din prompt.
- **Dashboard**: pagina `/appointments` (listă, filtre, schimbare status cu notificare client, ștergere) + intrare nav „Programări". Toggle „Rezervabil" în formularul de produs + badge + coloană CSV `rezervabil`.
- **Decizii**: handoff ușor (owner-ul confirmă intervalul), fără verificare de disponibilitate — extensia cu sloturi reale/anti dublă-rezervare e B6 în `BACKLOG.md`. `parseBookingIntent` testat (unit). `tsc --noEmit` verde pe API + web.

### Added (2026-06-01) — Preț estimativ („de la") + handoff ofertă custom + fix-uri agent

- **Scop** (din test real IMG_4201-4209): pentru businessuri cu prețuri „începând de la" (agenții software), agentul nu trebuie să propună un total fix sau să înregistreze o comandă — strânge cerințele și predă owner-ului pentru ofertă.
- **Flag `products.isEstimate`** (migrat în 3 locuri). Dacă un produs din coș e estimativ → `message.handler.ts` NU propune card „Total" și NU creează comandă; rămâne în discovery, trimite owner-ului „📌 Lead nou (ofertă custom)". Catalog în prompt: „de la X [preț estimativ — NU da total fix]".
- **Fix-uri de comportament**: `honestyGuard` întărit (interzice inventarea de persoane/colegi și relatarea unor discuții inexistente; cere consecvență — să nu nege un preț spus anterior). `classifyScopeLLM` calibrat (mesaje scurte/„??"/întrebări de continuare → BUSINESS; OFF_TOPIC doar cu subiect clar nelegat; INJECTION neatins).
- **`formatCatalogLine`** extras (pur, exportat) + testat. Toggle „Preț estimativ" + badge + coloană CSV `estimativ`. `tsc --noEmit` verde pe API + web.

### Added (2026-06-01) — Comenzi: referință scurtă `public_ref` (ord_xxx)

- **Scop**: clientul și owner-ul nu pot folosi UUID-ul intern al comenzii într-o conversație. Fiecare comandă primește o referință scurtă lizibilă (ex. `ord_a1b2c3`) — un „număr de bon" prietenos. ID-ul UUID rămâne pentru sistem.
- **Coloană `orders.public_ref`** (`schema.ts`). Migrare: `ADD COLUMN` nullable (ca să nu pice pe comenzile existente) + backfill imediat (`md5(random())`) pentru rândurile vechi; `genPublicRef()` în `orders.repository.create` setează mereu una pentru comenzile noi. Aceeași coloană adăugată și în setup-ul de test.
- **Afișare**: în mesajul de confirmare către client (`✅ Comanda ta a fost înregistrată (ord_xxx)`), în notificarea către owner pe WhatsApp, și ca badge în pagina `/orders` din dashboard. Tip `Order.publicRef` extins în web.
- `tsc --noEmit` verde pe API + web.

### Added (2026-06-01) — Onestitate agent + conștientizare stoc: stoc numeric + scenarii comandă

- **Problema**: agentul „vorbea" — promitea acțiuni neexecutate („am anunțat proprietarul") și nu putea gestiona stocul (catalogul avea doar `isAvailable` boolean, iar produsele indisponibile erau ascunse complet, deci agentul nici nu știa că există ca să spună „epuizat").
- **Pilon A — stoc numeric real**: coloană `products.stock` (`NULL` = nelimitat pentru servicii; `N` = cantitate; `0` = epuizat). Migrat în 4 locuri. `decrementStock(userId, productId, qty)` — scădere **atomică** (`WHERE stock >= qty`, previne race-ul a 2 clienți pe ultimul produs). UI Catalog: input stoc (gol = nelimitat) + badge „stoc: N"/„epuizat". Tipuri web + payload create/update/import extinse.
- **Pilon B — comportament onest al agentului**:
  - **Catalog complet în prompt** — agentul vede acum și produsele epuizate/indisponibile, cu starea marcată (`[EPUIZAT]`, `[INDISPONIBIL]`, `[stoc: N]`), ca să spună onest „momentan nu mai avem X" și să propună alternativă, în loc să le ascundă.
  - **Verificare stoc în COD** (nu LLM) după extragere: produs indisponibil / epuizat / cerere > stoc → ramură nouă care **blochează propunerea** și instruiește agentul să explice onest problema. Repară scenariile cerute (nu există / nu e disponibil / stoc insuficient).
  - **Scădere atomică la confirmarea „da"**: dacă între propunere și confirmare s-a epuizat stocul, comanda se **anulează onest** cu mesaj (+ rollback la ce s-a apucat să scadă). Produsele `NULL` (nelimitat) nu sunt afectate.
  - **Guard anti-promisiune** în system prompt (`honestyGuard`): agentul NU mai afirmă acțiuni neconfirmate (email, anunț owner, comandă) — doar ce i se spune explicit în context că s-a executat. Repară halucinațiile de tip „am trimis/am anunțat".
- Cod mort eliminat: `listAvailable` (înlocuit cu `list`). `tsc --noEmit` verde pe API + web. Se validează manual (necesită WhatsApp + stoc real în catalog).

### Added (2026-06-01) — Comenzi: email confirmare la cerere (Faza 5 — feature complet)

- **Scop** (din IMG_4117-18): clientul cere „vreau confirmarea pe email" și dă o adresă → primește un email cu rezumatul comenzii. Repară și bug-ul din poză unde agentul promitea email fără să aibă adresa.
- **`sendOrderConfirmationEmail(to, businessName, orders[])`** nou în `utils/email.ts`: refolosește `baseTemplate`/`escapeHtml`; randează linii + total + details. **Datele sunt pre-formatate de handler din prețurile din DB** — email.ts doar randează, nu atinge banii.
- **`message.handler.ts`** — dacă ultimul mesaj al clientului conține o adresă de email validă (regex + `z.string().email()`) ȘI clientul are o comandă recentă (≤24h, necancelată), trimitem confirmarea. Apoi instruim AI-ul (`emailNote`) să confirme scurt că emailul a plecat — **nu mai promite ce nu face**. Dacă a dat email dar n-are comandă, AI-ul NU spune că a trimis (evită halucinația din poză).
- **Securitate/guards**: adresa validată zod; **throttle 10 min/contact** (anti-spam); emailul merge la adresa pe care clientul însuși a dat-o, conține doar comenzile lui (scoped pe userId+contactPhone); **fără PII (adresă/email) în logs**; fail-soft (eroare email nu blochează conversația). Resend e în sandbox până la verificarea domeniului — în prod livrează doar către adresa contului Resend.
- `tsc --noEmit` verde pe API + web. **Feature comenzi conversațional COMPLET** (fazele 1-5). Se validează manual (necesită Resend + comandă reală).

### Added (2026-06-01) — Comenzi: citire date din imagini / vision (Faza 4)

- **Scop** (din IMG demo optician): clientul trimite o poză (rețetă, document, formular), agentul extrage datele și le folosește în colectarea comenzii — fără să tasteze manual SPH/CYL/AX etc.
- **`extractFromImage(buffer, mimeType, hint)`** nou în `groq.client.ts`: Gemini vision (`inlineData` base64, temp 0), ghidat de `order_intake_prompt`-ul businessului (la optică cere câmpurile de rețetă, la altele câmpurile relevante). Prompt strict: transcrie DOAR ce e vizibil, NU inventează valori lipsă; imagine irelevantă → răspunde `NIMIC_RELEVANT`.
- **`message.handler.ts`** — `processMessage` detectează `imageMessage` (lângă branch-ul audio existent), descarcă cu `downloadMediaMessage` (deja folosit la voce), extrage datele și le injectează ca mesaj de la client (`[Date extrase din imaginea trimisă de client]\n...`) → intră natural în mașina de stare a comenzii (Faza 2). Caption-ul, dacă există, e păstrat.
- **Securitate/guards**: doar `image/*`; limită 5 MB; imaginea stă **doar în memorie** (base64), nu se scrie pe disc; **fail-open** — dacă vision eșuează sau lipsește `GEMINI_API_KEY`, păstrăm caption-ul ca să nu pierdem mesajul; **fără conținut imagine în logs** (doar „imagine procesată"). Vision merge mereu pe Gemini (ca vocea pe Groq Whisper), independent de `LLM_PROVIDER`.
- `tsc --noEmit` verde pe API. Se validează manual (necesită imagine reală + cheie Gemini). **Rămâne**: Faza 5 (email confirmare).

### Added (2026-06-01) — Comenzi: notificare automată client la schimbarea statusului (Faza 3)

- **Problema** (din conversații reale, IMG_4116-18): clientul rămânea cu „Aștept confirmarea" — owner-ul schimba statusul comenzii în dashboard, dar clientul nu afla nimic. Bucla rămânea deschisă.
- **Fix** — la `PATCH /orders/:id/status`, dacă statusul se schimbă efectiv (tranziție reală, nu re-setare), clientul primește automat un mesaj pe WhatsApp: `confirmed` → „Comanda ta a fost confirmată", `completed` → „finalizată", `cancelled` → „anulată". `pending` (starea inițială) nu notifică.
- **`sendToContact(userId, contactPhone, text)`** nou în `whatsapp.session-manager.ts`: trimite proactiv prin sesiunea WA activă a owner-ului, salvează mesajul în istoric (`is_ai`) și-l emite pe stream-ul de conversații (apare în UI). **Fail-soft**: dacă WhatsApp nu e conectat, returnează `false` — statusul tot se salvează în dashboard.
- **Securitate**: mesajul merge la `contactPhone` din DB, scoped pe `req.user.id` (fără IDOR). Textul e **fix în cod**, nu trece prin LLM. Fără PII în logs.
- **UI** (`/orders`): owner-ul vede feedback după schimbarea statusului — „✅ Clientul a fost notificat" sau „ℹ️ Status salvat, clientul NU a fost notificat (WhatsApp neconectat)". Ruta întoarce `{ ok, notified }`.
- `tsc --noEmit` verde pe API + web. Fără ciclu de import (verificat: `ai.repository` nu importă din `whatsapp`). **Rămâne**: Faza 4 (vision/poză rețetă), Faza 5 (email confirmare).

### Added (2026-06-01) — Comenzi: colectare conversațională ghidată (flux 2 faze, Faza 2)

- **Problema** (din conversații reale, IMG_4116-18): la o cerere fără cantitate clară („vreau un website de 3000€"), AI-ul **inventa** o structură de catalog — „3× Aplicații web — 3000€" — fiindcă vechiul `extractOrder` gândea doar în `produs×cantitate` și forța orice în acel tipar. În plus promitea acțiuni neexecutate (email fără adresă).
- **Fix** — `extractOrder` înlocuit cu **`analyzeOrderIntent`** (`groq.client.ts`): mașină de stare în 3 faze (`none`/`collecting`/`ready`). LLM-ul **doar clasifică și extrage id-uri din catalog**; codul decide acțiunea și calculează banii din DB.
  - `collecting` → agentul **cere natural ce lipsește** (`missingInfo` injectat în prompt), NU propune rezumat, NU inventează cantități/prețuri.
  - `ready` (produse clare + info completă) → cod construiește rezumatul cu **total din DB** → cere confirmarea (marker existent) → creează DOAR după „da" (`classifyOrderConfirmation`, fail-safe).
  - **Custom-budget** (ex: „website 3000€", fără produs în catalog) → rămâne `collecting`, cererea intră în `details`, agentul spune că **proprietarul confirmă prețul** — LLM-ul nu atinge banii.
- **Validare strictă în cod** — `parseOrderIntent` (extras pentru test fără rețea): id ∈ catalog (altfel aruncat), qty plafonat 0–999, `ready` fără produs valid → retrogradat la `collecting`, `missingInfo` ≤ 8×120 char, `details`/`customerNote` plafonate. JSON invalid → fază goală.
- **Schema** — `orders.details` (specificații structurate colectate) + `ai_settings.order_intake_prompt` (instrucțiuni colectare per-business: optică ≠ pizzerie). Migrat în cele 4 locuri (`schema.ts`, `migration-statements.ts`, `app.ts`, `test/global-setup.ts`).
- **UI** — câmp „Instrucțiuni colectare comandă" în Setări → Conținut; pagina `/orders` afișează `details` (🧾). API client (`lib/api.ts`) extins (`orderIntakePrompt` în `AiSettings` + `updateSettings`, `details` în `Order`).
- **Test nou** — `order.intent.test.ts` (16 cazuri, fără rețea): catalog-guard, retrogradări de fază, custom-budget, plafonări, fallback JSON invalid.
- `tsc --noEmit` verde pe API + web. **Rămâne**: Faza 3 (dashboard: status→mesaj client la confirmare owner), Faza 4 (vision/poză rețetă), Faza 5 (email confirmare).

### Added (2026-05-31) — Comenzi: confirmare înainte de creare (flux conversațional, Faza 1)

- **Problema** (din conversații reale, IMG_4091-93): AI-ul crea comanda *instant* la prima intenție vagă („vreau un website" → „Am notat comanda ta: 1000€") înainte să întrebe orice — penibil, exact ca la pizza. Clientul reacționa: „Păi nu mă întrebați de detalii?".
- **Fix** (`message.handler.ts` + `groq.client.ts`): la prima detectare de produse, AI-ul **propune** un rezumat cu total și cere confirmarea (marker `ORDER_CONFIRM_MARKER`), **fără a crea** comanda. Comanda se înregistrează în DB **doar după** ce clientul confirmă explicit — verificat de `classifyOrderConfirmation` (apel Groq scurt, temp 0) cu poartă `parseConfirmation` (doar „DA" cuvânt-întreg → true; fail-safe la NU/ambiguu). Prețurile/totalul rămân din DB, niciodată din LLM.
- Dacă a fost propusă dar neconfirmată, AI-ul răspunde firesc la mesajul curent (context injectat în prompt) și amintește scurt să confirme cu „da" — fără să spameze rezumatul.
- Test nou: `parseConfirmation` în `lead.parser.test.ts`.
- **Rămâne pentru fazele următoare** (din IMG_4091-93): `details` actualizabile pe comandă + „confirmarea" promisă clientului conectată cu schimbarea statusului în dashboard (mesaj automat la confirmare owner). Vezi `docs/FEATURE_ORDERS_CONVERSATIONAL.md`.

### Added (2026-05-31) — Calificare lead-uri (backend, Faza 1-2)

- **Schema** — tabel nou `lead_insights` (userId, contactPhone, status `hot/warm/cold`, score 0-100, reason, timestamps; UNIQUE userId+contactPhone; index pe userId+score) + coloană `ai_settings.lead_criteria` (text liber: ce înseamnă un lead bun pentru acel business). Migrat în toate cele 4 locuri (`migration-statements.ts`, `schema.ts`, `app.ts` runStartupMigrations, `test/global-setup.ts` + cleanup în `test/setup.ts`).
- **Clasificare LLM** — `classifyLead(criteria, messages)` în `groq.client.ts`: apel Groq (temp 0) care întoarce JSON `{status, score, reason}`, **validat strict în cod** (status ∈ hot/warm/cold sau derivat din scor; scor plafonat 0-100; reason limitat). Doar clasifică, nu pune întrebări clientului. Criterii goale → ghid generic.
- **Repository/Service** — `getLeads` (toate contactele + scorul cached, LEFT JOIN, sortate pe scor), `upsertLeadInsight`, `getRecentContactPhones`; service `analyzeLead` (un contact) + `analyzeAllLeads` (lot plafonat la 40, fail-soft per contact).
- **Rute** — `GET /ai/leads` și `POST /ai/leads/analyze` (body opțional `{phone}` = un contact, fără body = lot). Ambele `authenticate`, scoped pe `req.user.id`; analyze are rate limit 5/min (cost LLM real). `lead_criteria` adăugat în schema `PATCH /ai/settings`.
- Scorarea e **la cerere** (din dashboard), nu automat la fiecare mesaj — cost LLM controlat.

### Added (2026-05-31) — Calificare lead-uri (UI, Faza 3)

- **Pagină nouă `/leads`** (`apps/web/src/app/(dashboard)/leads/page.tsx`) — listă contacte sortate pe scor, badge hot/warm/cold + scor + justificare AI, filtre pe status, buton „Recalculează scoruri" (lot) și „Recalculează" per contact. Stil consistent cu pagina Comenzi.
- **Navigare** — intrare „Lead-uri" (icon Flame) în sidebar + drawer mobil (`(dashboard)/layout.tsx`).
- **Settings** — câmp nou „Criterii calificare lead-uri" în tab-ul Conținut → `leadCriteria` (`settings/page.tsx`).
- **API client** (`lib/api.ts`) — tipuri `Lead`/`LeadStatus`/`LeadInsight`, `leadCriteria` în `AiSettings` + payload `updateSettings`, metode `api.ai.getLeads` / `api.ai.analyzeLeads`.
- Notă: la rezolvarea unei erori de build s-a descoperit că `settings/page.tsx` și `orders/page.tsx` aveau conținut duplicat (JSX repetat din editări anterioare de sesiune) — ambele rescrise curat. Build web verde, `tsc --noEmit` curat pe API + web.

### Added (2026-05-31) — Monedă per business (RON/EUR/USD/GBP)

- **Schema** — coloană `ai_settings.currency` (default `RON`), validată `z.enum(['RON','EUR','USD','GBP'])` în `PATCH /ai/settings`. Migrat în cele 4 locuri. **Banii rămân integer subunitate** — se schimbă doar eticheta afișată; **fără conversie valutară** (un business = o monedă, totalul rămâne coerent).
- **Helper partajat** `apps/web/src/lib/format.ts` — `formatAmount`, `currencyLabel`, `formatMoney`, `CURRENCIES`. Înlocuiește `formatLei` local duplicat din `orders` + `products`.
- **UI** — selector monedă în Setări → Agent; `orders` și `products` afișează moneda businessului (în loc de „lei” hardcodat); eticheta din formularul de preț e dinamică. Backend: mesajul de confirmare comandă, notificarea owner și catalogul injectat în prompt folosesc eticheta monedei (`message.handler.ts`).

### Fixed (2026-05-31) — Regresie settings + teste noi

- **Regresie reparată**: la rescrierea `settings/page.tsx` (Faza 3) se pierduseră funcționalități din original (toggle activare/dezactivare AI, „Analizează automat” stil, lista comenzi WhatsApp, avertismente admin/WA neconectat, salvări per-secțiune). Pagina a fost restaurată complet, cu currency + leadCriteria adăugate peste structura originală.
- **Teste noi** (le rulează userul): `lead.parser.test.ts` (12 teste pe validarea strictă a JSON-ului LLM din `parseLeadClassification` — extrasă ca funcție pură) + extinderi în `ai.integration.test.ts` (currency default/set/enum-invalid, leadCriteria, `GET /ai/leads` gol, `POST /ai/leads/analyze` lot gol fără apel LLM + phone invalid).
- **Setup test reparat**: `global-setup.ts` adaugă `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pentru `lead_criteria` + `currency` — altfel pe o DB de test creată înainte de aceste coloane, `CREATE TABLE IF NOT EXISTS` NU le-ar fi adăugat și ai fi avut teste picate local care în prod ar fi fost OK.

### Fixed (2026-05-31)

- **Comenzi duplicate + răspuns robotic repetat** — `extractOrder` primea tot istoricul conversației, deci la FIECARE mesaj ulterior re-extrăgea aceeași comandă → crea o comandă nouă în DB și retrimitea identic „Am notat comanda ta… Îți confirmăm în scurt timp" (vizibil în prod: zeci de comenzi „2× Pizza Diavola" identice + conversație unde AI-ul nu răspundea la „în cât timp se livrează?"). Fix în `message.handler.ts` → `sendAiResponse`: înainte de a crea comanda, se calculează o semnătură `productId×qty` și se compară cu comenzile recente ale contactului (`ordersRepository.listRecentForContact`, fereastră 12h, exclude `cancelled`). Dacă există deja o comandă identică, NU se mai creează una nouă și NU se retrimite confirmarea — se injectează contextul comenzii active în system prompt (`[Comandă activă a clientului]`) și AI-ul răspunde firesc la mesajul curent (livrare, modificări, confirmare).
- **Ștergere comenzi** — owner-ul poate șterge o comandă din `/orders` (buton coș per rând, cu confirmare). Backend: `DELETE /api/v1/orders/:id` (`orders.routes.ts`) + `ordersRepository.delete` (liniile cad prin `ON DELETE CASCADE`); client: `api.orders.remove` + `handleDelete` în `orders/page.tsx`.

### Changed (2026-05-31)

- **Lățime unificată dashboard** — toate paginile din dashboard au acum aceeași lățime (`max-w-6xl`), centralizată în `layout.tsx` (sursă unică). Înainte fiecare pagină avea alt `max-w` (2xl–5xl) → arătau inconsistent și prea înguste pe centru. Eliminat `max-w` per-pagină din dashboard/orders/products/settings/profile/connect/conversations.
- **Catalog mobile** — header (titlu + butoane) trece pe rânduri separate pe mobil; rândul de produs afișează prețul sub nume pe ecrane mici (nu mai e înghesuit lângă butoane).

### Added (2026-05-30)

- **Metrici avansate (Performanță agent)** — secțiune nouă în dashboard: conversații preluate de AI, rată de rezolvare fără intervenție (`takeoverRate`), conversații escaladate către owner, grafic cu bare pe ultimele 7 zile. Toate derivate din `conversation_messages` (fără tabele noi) — `getAdvancedStats` în `ai.repository.ts`, rută `GET /ai/stats/advanced`. Escaladare = owner a scris manual după ce AI răspunsese; rezolvare = AI a închis fără intervenție ulterioară.
- **Navigare hamburger consistentă** — înlocuit sidebar-ul fix (desktop) + bottom nav (mobile, devenise înghesuit cu 6 itemi) cu un singur pattern: top bar cu buton hamburger → drawer lateral, identic pe desktop și mobile. Închidere la click link / overlay / ESC, blocare scroll body cât e deschis.
- **Fix zoom iOS** — `globals.css`: font minim 16px pe `input/textarea/select` sub 640px, oprește auto-zoom-ul Safari la focus pe câmpuri (afecta settings/products/orders cu `text-[13px]`).
- **Popup expirare trial** — pe dashboard apare un popup la ≤3 zile rămase din trial (status `trialing`, necancelat), dismissibil o dată pe zi per browser (localStorage). Înlocuiește ideea de email reminder.
- **Import CSV catalog** — owner-ul încarcă un CSV cu produse în `/products` (parsat în browser, fără dependențe noi: `lib/csv.ts`). Coloane flexibile RO/EN (`nume`/`name`, `pret`/`price`, opțional `categorie`/`descriere`/`disponibil`), auto-detect separator `,`/`;`, suport ghilimele + BOM Excel. Preview cu validare per-rând înainte de confirmare; endpoint bulk `POST /products/import` (max 1000 rânduri). Produsele se adaugă la cele existente. System prompt-ul rămâne separat (pentru întrebări casual de preț).
- **Comenzi prin WhatsApp** — catalog de produse per user (`products`) + comenzi (`orders`, `order_items`). Owner gestionează catalogul din `/products` și comenzile din `/orders` (listă, filtre pe status, schimbare status pending→confirmed→completed→cancelled). AI-ul extrage comenzi din conversație (`extractOrder`, Groq/Gemini, temp 0, JSON validat strict), creează comanda în DB (`pending`), confirmă clientului cu total și notifică owner-ul pe WhatsApp. **Prețurile/totalul se calculează în cod din DB, niciodată de LLM** (protecție prompt injection). Catalogul disponibil se injectează și în prompt-ul normal pentru oferte corecte.
- **Switch furnizor LLM** — `LLM_PROVIDER` env (`groq` default / `gemini`). Dispatcher în `groq.client.ts` (`callGroq`) rutează generarea de text; Gemini 2.0 Flash via `callGeminiApi`. Transcrierea vocală rămâne mereu pe Groq Whisper. Fail-safe: dacă `gemini` selectat fără cheie, cade pe Groq.
- **Gatekeeper LLM business-only** — userii reali au reușit să scoată AI-ul din scop (bancuri, rețete) pentru că guard-ul keyword (`classifyBusinessScope`) prinde doar formulări exacte. Adăugat strat secundar `classifyScopeLLM` (`groq.client.ts`): apel Groq scurt (temp 0, max 10 tokens) care clasifică ultimul mesaj `BUSINESS`/`OFF_TOPIC`/`INJECTION` când keyword-urile au lăsat să treacă. Fail-open la eroare Groq (nu blocăm clienți reali). Mesajele blocate se loghează cu `scope` (`message.handler.ts`).

### Fixed (code review 2026-05-30)

- **CR-S3** — Statistici AI calculate pe ora României (`Europe/Bucharest`, cu DST) în loc de UTC; „luna" e acum luna calendaristică curentă, nu ultimele 30 de zile rolling (`ai.repository.ts` → `getStats` + helperii `startOfDayInTz`/`startOfMonthInTz`)
- **CR-S4** — Dashboard: cardul Trial afișează `Mesaje AI (30z)` din `stats.month`, înlocuit placeholder-ul hardcodat `—` (`dashboard/page.tsx`)
- **CR-S5** — `extractContactMemory` throttled la max o dată / 10 min per contact — elimină apelul Groq suplimentar la fiecare răspuns AI (`message.handler.ts`)
- **CR-S7** — Rate limit `30/min` adăugat pe `GET /ai/stream` (SSE)
- **CR-S8** — Curățenia „ultimele 50 mesaje" rulează probabilistic (~10%), nu la fiecare INSERT — un query DB în minus per mesaj (`ai.repository.ts` → `saveMessage`)
- **CR-S9** — Guard prompt-injection prinde acum obfuscarea cu separatori (`i-g-n-o-r-a`, `i g n o r a`) prin comparație pe versiune compactă (`message.handler.ts` → `classifyBusinessScope`)
- **CR-S10** — Deduplicare webhook Stripe: tabel nou `stripe_events`; evenimentele deja procesate se confirmă cu `200` fără re-rulare (protecție la at-least-once delivery) (`stripe.webhook.ts`). Dedup-ul rulează doar dacă `event.id` există — fără cheie sărim peste (un event Stripe real are mereu id; evităm 500 + retry inutil).
- **CR-S13** — `global-setup.ts` (setup teste) actualizat cu tabelul `stripe_events` — lipsea, cauza celor 10 teste de webhook picate local (prod nu era afectat, migrarea rulează din `migration-statements.ts`). Notă: schema e dublicată în 3 locuri (`migration-statements.ts` / `app.ts` / `global-setup.ts`) — candidat de refactor pentru a importa dintr-o singură sursă.

### Removed

- **CR-S11** — Eliminat debug `process.stdout.write('[ENV]...')` din `env.ts` (2 linii)
- **CR-S12** — Șters `gemini.client.ts` (cod mort, neimportat) + scos `GEMINI_API_KEY` din schema env

---

## [0.9.0] — 2026-05-27

### Security

- **SEC-005** — PII eliminat din logurile de producție: numere de telefon și preview-uri de mesaje nu mai apar în logs
- **SEC-007** — GDPR: ștergere cont self-service în 48h (`DELETE /api/v1/users/me`); buton în pagina `/gdpr`; email de confirmare trimis; cleanup automat la startup + interval orar
- **SEC-008** — CSP activat pe API (`@fastify/helmet`); HSTS adăugat pe frontend (`next.config.mjs`); CSP pe frontend cu domenii explicite (Google Fonts, Vercel Analytics)
- **SEC-010** — `E2E_MODE` blocat în producție (`NODE_ENV !== 'production'`); rutele de test nu mai pot fi activate pe Railway
- **SEC-011** — XSS escaping consistent în emailuri admin: `escapeHtml()` aplicat pe `name`, `title`, `body` în toate template-urile
- **SEC-014** — Rate limiting adăugat pe `POST /whatsapp/connect` (5/min) și `POST /ai/analyze-style` (3/min)
- **SEC-003/004** — Rate limiting adăugat pe `POST /admin/auth` (10/15min); PIN-ul rămâne mecanismul de autentificare admin
- **CORS** — `CORS_ORIGINS` env var pentru origini multiple (util pentru Vercel preview URLs)
- **E2E** — Rutele de test securizate cu header `x-e2e-secret`

### Refactoring & Code Quality

- **CR-007/08/09** — `console.error` înlocuit cu `logger.error` în `auth.service.ts`, `notifications.service.ts`, `admin.routes.ts`
- **CR-013** — `ThemeToggle` extras ca component shared (`apps/web/src/components/ThemeToggle.tsx`); eliminat din 4 locuri cu cod duplicat
- **CR-014** — Schema DB centralizată în `apps/api/src/db/migration-statements.ts`; `migrate.ts` și `index.ts` importă din același loc
- **CR-006** — `console.log('[DEBUG ENV]')` eliminat din `migrate.ts`
- **CR-015** — `upsertContactMemory` refactorizat cu `INSERT ... ON CONFLICT DO UPDATE` (un singur query în loc de SELECT + UPDATE/INSERT)
- **CR-022** — Rutele E2E securizate cu `x-e2e-secret` header verificat în `preHandler`
- **CR-002** — `whatsappAuthState` export eliminat din `schema.ts` (dead code — raw SQL folosit pentru Baileys)
- **CR-003** — Tipuri neutilizate eliminate din `auth.schemas.ts` (`ForgotPasswordInput`, `ResetPasswordInput`, `VerifyEmailInput`)
- **CR-004** — `getActiveSocket()` eliminat din `whatsapp.session-manager.ts` (folosit doar în mock-uri de test)

### Docs

- Creat `docs/RUNBOOK.md` — proceduri de incident (restart Railway, rollback, migrare manuală, GDPR, rate limit blocat)
- Creat `docs/ARCHITECTURE.md` — decizii de design non-evidente (dual migration, Baileys în Postgres, CJS/ESM, JWT pattern, rate limiting, GDPR flow, design tokens)
- Șters `docs/FIX.md` — toate itemele rezolvate

---

## [0.8.0] — 2026-05-26

### Deployment — Railway (API) + Vercel (Frontend)

#### Railway API
- `Dockerfile` creat pentru build monorepo (`pnpm@9`, `apps/api`)
- `railway.json` configurat cu `DOCKERFILE` builder + `ON_FAILURE` restart policy
- Migrații mutate inline în `index.ts` cu **5 retry-uri** (3s delay) — Railway Hobby Postgres doarme la startup și cauzează `ETIMEDOUT` la prima tentativă
- Start command: `node apps/api/dist/index.js` (un singur proces, fără `&&`)
- Port: Railway auto-injectează `PORT=8080` → Networking configurat pe 8080
- API live: `https://api-production-2318d.up.railway.app`

#### Vercel Frontend
- Root Directory: `apps/web` (nu repo root)
- Singura variabilă necesară: `NEXT_PUBLIC_API_URL=https://api-production-2318d.up.railway.app`
- Vercel Analytics adăugat (`@vercel/analytics/next` în `layout.tsx`)
- Frontend live: `https://whatsapp-ai-web-rho.vercel.app`

#### Fix CORS cross-origin (Vercel → Railway)
- Cookie `refreshToken`: `sameSite: 'lax'` → `sameSite: 'none'`, `secure: true` (necesar cross-site)
- `clearCookie` la logout: adăugat `{ secure: true, sameSite: 'none' }`
- CORS origin: înlocuit string fix cu funcție care normalizează trailing slash din `APP_URL`
- `APP_URL` în Railway: `https://whatsapp-ai-web-rho.vercel.app`

### Known issues (post-lansare)
- **Resend**: emailurile merg doar la adresa contului Resend (sandbox). Necesită domeniu propriu verificat în Resend pentru utilizatori reali.

---

## [0.7.1] — 2026-05-26

### Fixed
- `DEFAULT_PROMPT` din `ai.repository.ts` — eliminat date personale reale (Liviu Băncilă, ACL Smart Software); înlocuit cu prompt generic neutru
- Timer save button (`settings/page.tsx`) — eliminat `timerMinutes === settings?.timerMinutes` din condiția `disabled`; Playwright `fill()` pe `input[type="number"]` nu declanșează React `onChange`
- Creat `whatsapp_ai_test` (vitest) și `whatsapp_ai_e2e` (Playwright) cu `ENCODING='UTF8'` — lipseau la migrarea pe PostgreSQL

### Infrastructure
- PostgreSQL pornit și configurat pe mașina de dev (Scoop, `C:\dev\apps\postgresql\18.4`)
- Rol `liviu` creat în PostgreSQL (superuser local, fără parolă)
- Toate cele 3 DB create și migrate cu UTF-8

---

## [0.7.0] — 2026-05-25

### Added — Faza 7: Landing Page
- Navbar flotant (floating pill) cu dark mode toggle și mobile menu
- Hero section cu headline mare, announcement chip animat, CTA-uri (signup + demo 90s), trust bar
- OperatorConsole — demo interactiv animat cu chat live, status agent, recent activity, stats grid
- Ticker — marquee cu activitate live (auto-scroll)
- HowItWorks — 3 pași (QR → Knowledge Base → Activare agent) cu carduri vizuale
- Features — 9 funcționalități în format tabel cu micro-vizuale inline
- Differentiator — secțiune personality cloning, side-by-side (scriere ta vs. agent, fingerprint 99% match)
- Pricing — 2 planuri (49.99 RON/lună, 399 RON/an), 7 zile trial, trust footer
- FAQ — 6 întrebări, acordion `details/summary` nativ
- Footer — logo, descriere, link-uri legale (termeni, confidențialitate, GDPR, cookies)
- `scrollToFooter` via sessionStorage (redirect corect din paginile legale)
- Dark mode complet cu persistare în localStorage

---

## [0.6.0] — 2026-05-24

### Added — Faza 6: AI Avansat
- RAG: memorie pe termen lung per contact (`contact_memory` table, extragere via Groq)
- Knowledge Base: câmp text în Settings, injectat în system prompt la fiecare răspuns
- Personality cloning: analiză automată stil scriere din ultimele 60 mesaje trimise (`POST /ai/analyze-style`)
- Transcriere mesaje vocale: Groq Whisper API, format OGG/PTT de la WhatsApp
- Detecție sentiment: keyword-based (urgent/frustrat), hint injectat în prompt
- Răspunsuri personalizate: `writingStyle` injectat în system prompt

### Security (audit complet)
- C1: Admin auth nu mai returnează `ADMIN_SECRET` în response body → `{ ok: true }`
- C2: `STRIPE_WEBHOOK_SECRET` devine required (nu mai e optional) — bypass semnătură eliminat
- H1: `accessToken` exclus din localStorage (Zustand persist) → doar în memorie
- H2: Rate limiting pe toate rutele auth (`/register`, `/login`, `/forgot-password`, `/reset-password`)
- H3: `emailVerifyToken` hashed HMAC-SHA256 în DB (consistent cu `resetPasswordToken`)
- H4: XSS escaping în emailurile custom trimise de admin (`escapeHtml()`)
- M1: `cleanOldLoginAttempts()` apelat la startup + periodic (1h interval)

### Migrated
- Backend migrat de la SQLite (`@libsql/client`) la **PostgreSQL** (`pg` + `drizzle-orm/node-postgres`)
- `global-setup.ts` și `setup.ts` actualizate pentru PostgreSQL
- `vitest.config.ts`: `DATABASE_URL=postgresql://localhost/whatsapp_ai_test`

### Tests
- 9 teste noi `detectSentiment()` → 156/156 API ✅
- E2E: 54/54 ✅ (re-verificat după Faza 6)

### Infrastructure fix (2026-05-25)
- Test DB `whatsapp_ai_test` recreat cu `ENCODING='UTF8'` — WIN1252 implicit Windows bloca INSERT cu diacritice românești (eroare PostgreSQL `22P05`)

---

## [0.5.0] — 2026-05-21

### Added — Faza 5: Admin Panel
- Dashboard admin cu stat cards (Total useri, Abonați, Agenți, MRR)
- Tab Useri: toggle agent, extindere trial, trimitere email, deconectare WA, ștergere cont
- Tab Activitate: feed notificări cronologic
- Tab Configurare: system prompt implicit pentru useri noi
- Notificări admin (bell icon, unread count, mark-read)
- `platform_config` table (key-value store setări platformă)
- Auto-dezactivare agent la `past_due`, `canceled`, `invoice.payment_failed`
- Notificări automate la: user nou, plată eșuată, subscription deleted

### Tests
- 63 teste noi API (admin + ai routes) → 136/136 ✅
- 11 teste noi webhook Stripe → 147/147 ✅
- E2E Playwright: 54/54 ✅

---

## [0.4.0] — 2026-05

### Added — Faza 4: AI Engine (Groq) + Inactivitate + Comenzi
- Integrare Groq API (Llama 3.3 70B)
- Timer inactivitate configurabil (1-60 min)
- Comenzi WhatsApp: `/activateAI`, `/deactivateAI`, `/pauseAI`, `/resumeAI`, `/setTimer`, `/skipAI`, `/unskipAI`, `/status`, `/help`, `/clearHistory`
- Blacklist contacte per user
- Context conversație (ultimele 20 mesaje)
- Pagina Settings: toggle AI + timer + system prompt + blacklist CRUD

### Tests
- Unit tests command parser: 18 teste
- Unit tests inactivity tracker: 8 teste
- WhatsApp integration: 7 teste → 72/72 ✅

---

## [0.3.0] — 2026-05

### Added — Faza 3: WhatsApp Baileys + QR
- Integrare `@whiskeysockets/baileys@6.17.16`
- Autentificare via QR code (pairing code abandonat — WhatsApp îl respingea silențios)
- `makeCacheableSignalKeyStore` pentru prevenire I/O race conditions pe signal keys
- Persistare sesiune Baileys pe disc, reconnect automat

---

## [0.2.0] — 2026-05

### Added — Faza 2: Stripe Subscriptions
- Subscripții lunar (49.99 RON) și anual (399 RON)
- Trial 7 zile la înregistrare
- Webhook handler: checkout, subscription updated/deleted, invoice payment_failed
- Pagina `/subscribe`, badge status în dashboard

---

## [0.1.0] — 2026-05

### Added — Faza 1: Auth + Monorepo
- Monorepo pnpm workspaces (`apps/api` + `apps/web`)
- Auth complet: register, verify-email, login, logout, forgot/reset password
- JWT: access token 15min + refresh token 7d httpOnly cookie cu rotație
- bcrypt cost 12, rate limiting login, no user enumeration
