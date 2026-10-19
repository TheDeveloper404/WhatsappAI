# ARCHITECTURE — WhatsApp AI (personal, single-user)

## Stack
- **Runtime:** Node 22+, TypeScript (ESM). Un singur proces, fără server HTTP, rulat de systemd.
- **WhatsApp:** Baileys 7 (`baileys@7.0.0-rc14`, ESM), sesiune stocată în Postgres.
- **DB:** PostgreSQL + Drizzle ORM (query builder) + raw `pg` acolo unde contează volumul.
- **LLM:** OpenRouter (API OpenAI-compatible), model din `LLM_MODEL`. Vocale tot prin OpenRouter (`input_audio`), model din `LLM_AUDIO_MODEL`, opțional.
- **UI:** niciunul — configurarea se face din WhatsApp (comenzi în self-chat).

## Flux mesaj primit
```
Baileys messages.upsert (notify)
  → dedup msg.key.id (processed_messages)
  → self-chat? → doar comenzi (/status, /kb, ...)
  → anti-flood (incoming.rate-limiter, RAM)
  → audio → OpenRouter input_audio (dacă LLM_AUDIO_MODEL) | text/caption
  → fromMe? → comandă (nu se salvează) | salvează + marchează owner activ (inactivity.tracker)
  → salvează mesaj → agent activ / nu e pauză / contact neblocat?
  → owner activ în ultimele N min? → programează răspuns după timer : răspunde acum
  → filtru determinist off-topic/injection → system prompt (reguli + prompt + stil + KB + memorie)
  → OpenRouter chat → trimite → notifică owner-ul (throttled) → actualizează memoria contactului (throttled)
```

## Decizii non-evidente

### 1. Single-user, dar `user_id` rămâne în schemă
Toate tabelele păstrează `user_id` (FK spre `users`), iar codul folosește constanta `OWNER_ID`
(`config/owner.ts`, default `owner`). Motiv: compatibilitate cu datele dintr-o instalare SaaS veche
și zero rescriere în repository-uri. Rândul din `users` e seed-uit la pornire (`ownerSeedStatement`).

### 2. Migrări = `db/migration-statements.ts`
Raw SQL idempotent (`CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), rulat la fiecare pornire
din `index.ts` cu retry (Postgres poate porni după API). Nu folosim drizzle-kit. Orice tabel/coloană
nouă se adaugă acolo **și** în `db/schema.ts`.

### 3. Auth state WhatsApp în Postgres, nu pe disc
Containerele sunt efemere; sesiunea (creds + chei Signal) stă în `whatsapp_auth_state`, criptată
AES-256-GCM cu `WHATSAPP_ENC_KEY`. Raw `pg` (nu Drizzle) — Baileys face sute de operații mici;
`keys.set` scrie într-o singură tranzacție (o scriere parțială corupe sesiunea Signal).

### 4. Baileys 7 (ESM) și contactele `@lid`
Pachetul `baileys` v7 e ESM-only → importuri normale (`import makeWASocket, { ... } from 'baileys'`).
WhatsApp trimite tot mai multe chaturi cu un ID de confidențialitate (`...@lid`) în loc de număr. Numărul real
vine din `msg.key.remoteJidAlt` sau din `sock.signalRepository.lidMapping.getPNForLID()` — în practică des lipsește.
De aceea blacklist-ul ține și **LID-ul** fiecărui număr blocat (`contacts_blacklist.lid`), aflat cu
`lidMapping.getLIDForPN()` (interogare USync la serverele WhatsApp) la `/block` și, pentru rândurile fără LID, la
fiecare conectare. Potrivirea se face pe număr SAU LID. Dacă există vreun număr blocat cu LID încă neaflat, un mesaj
`@lid` fără număr cunoscut **nu primește răspuns** (fail-closed) și owner-ul e anunțat.

### 5. Pornire = reconectare sau QR
`startWhatsapp()` creează mereu un socket cu creds-urile din DB: dacă sunt asociate se reconectează,
altfel Baileys emite QR (afișat în terminal / `journalctl`). Sesiune asociată → reconectare la
nesfârșit cu backoff (3s → 60s). Neasociată → oprire după 5 cicluri de QR (restart serviciu = QR nou).
`loggedOut` șterge creds-urile; `440` (altă instanță) oprește. Un `setInterval` ține procesul viu
când socket-ul e oprit, ca systemd să nu intre în buclă de restart.

### 6. State în RAM — o singură instanță
`pendingResponses` (timere), throttles de notificare/memorie, anti-flood și `inactivity.tracker` sunt
în memorie: se pierd la restart (după restart AI-ul răspunde imediat) și nu se sincronizează între
instanțe. Rulează **un singur** proces.

### 7. LLM-ul nu are unelte
Agentul doar conversează. Nu poate trimite emailuri, crea comenzi etc. — de aici „honesty guard"-ul
din system prompt. Memoria contactului și KB-ul sunt marcate ca **date, nu instrucțiuni**
(anti prompt-injection stocat).

### 8. Comenzile owner
Vin pe calea `fromMe` direct din socket. Configurația (`/kb`, `/prompt`, `/learnStyle`) se
modifică doar din self-chat; răspunsurile la comenzi merg mereu în self-chat, ca un contact să nu
vadă setările. Comenzile nu se salvează în istoric (nu ajung în contextul LLM).
