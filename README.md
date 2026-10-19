# WhatsApp AI — agent personal

Agent WhatsApp **single-user**: se conectează la numărul tău (Baileys, ca un dispozitiv asociat) și
răspunde automat în locul tău când ești inactiv, în stilul tău. Control din WhatsApp prin comenzi;
dashboard web minimal opțional (status, QR, conversații recente).

## Funcționalități
- **Răspuns automat la inactivitate** — dacă n-ai răspuns unui contact în ultimele N minute (`/setTimer`), AI-ul răspunde.
- **LLM prin OpenRouter** — orice model (`LLM_MODEL=google/gemini-2.5-flash`, `anthropic/claude-sonnet-4.5`, ...), cu fallback opțional.
- **Memorie per contact** — rezumat actualizat automat (nume, nevoi, context).
- **Knowledge base** — text liber setat din WhatsApp (`/kb set ...`), injectat în prompt.
- **Stilul tău** — `/learnStyle` analizează mesajele tale și le imită tonul.
- **Vocale** — transcriere cu Groq Whisper (opțional, `GROQ_API_KEY`).
- **Siguranță** — filtru off-topic/prompt-injection, alertă la mesaje sensibile (avocat, ANPC, rambursare), anti-flood pe cost, blocare contacte.
- **Sesiune în Postgres** (criptată) — reconectare automată după restart/redeploy.

## Comenzi WhatsApp
Trimise de pe numărul tău. Configurația se schimbă din chatul cu tine însuți („Tu").

| Comandă | Efect |
|---|---|
| `/activateAI` · `/deactivateAI` | pornește / oprește agentul |
| `/pauseAI 2h` · `/resumeAI` | pauză temporară / reluare |
| `/setTimer 5` | minute de inactivitate (1–60) |
| `/status` | stare, timer, nr. răspunsuri AI în 24h |
| `/clearHistory` · `/block` · `/unblock` | în chatul unui contact: șterge istoricul / exclude / reinclude |
| `/kb` · `/kb set <text>` · `/kb add <text>` · `/kb clear` | knowledge base |
| `/prompt` · `/prompt set <text>` · `/prompt reset` | instrucțiunile agentului |
| `/learnStyle` | învață stilul tău de scriere |
| `/help` | lista comenzilor |

## Pornire locală
```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # OPENROUTER_API_KEY, DATABASE_URL, ...
docker run -d --name wa-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=whatsapp_ai -p 5432:5432 postgres:16-alpine
pnpm dev:api                                # scanează QR-ul din terminal sau din http://localhost:3001
```

## Deploy
VPS cu Docker Compose + Postgres + Caddy sau Cloudflare Tunnel: vezi [`docs/DEPLOY_VPS.md`](docs/DEPLOY_VPS.md).

## Documentație
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — flux și decizii non-evidente
- [`docs/ENV_VARS.md`](docs/ENV_VARS.md) — variabile de mediu
- [`docs/DEV_SETUP.md`](docs/DEV_SETUP.md) — dezvoltare locală
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md)

## Structură
```
apps/api/src
├── index.ts                 # boot: migrări + seed owner, server, pornire WhatsApp
├── app.ts                   # Fastify: helmet, rate-limit, dashboard, /health
├── config/                  # env (zod), database (pg + drizzle), owner (OWNER_ID)
├── db/                      # schema.ts + migration-statements.ts (source of truth)
└── modules/
    ├── whatsapp/            # session manager (Baileys), auth state în Postgres
    ├── ai/                  # message.handler, llm.client (OpenRouter), comenzi, anti-flood
    └── dashboard/           # pagina minimală + API protejat cu HTTP Basic
```

> Notă: utilizarea unui client WhatsApp neoficial (Baileys) încalcă, cel mai probabil, termenii WhatsApp
> și poate duce la blocarea numărului. Folosește-l pe propria răspundere.
