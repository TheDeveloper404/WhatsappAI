# Changelog — WhatsApp AI

Format bazat pe [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

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
