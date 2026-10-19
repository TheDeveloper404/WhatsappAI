# WhatsApp AI — agent personal

Agent WhatsApp **single-user**: se conectează la numărul tău (Baileys, ca un dispozitiv asociat) și
răspunde automat în locul tău când ești inactiv, în stilul tău. Fără UI: totul se configurează din
WhatsApp prin comenzi. Rulează pe un VPS ca serviciu systemd (Node + PostgreSQL).

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
| `/status` | stare, timer, model, nr. răspunsuri AI în 24h |
| `/notify on` · `/notify off` | notificări „AI a preluat conversația” |
| `/clearHistory` · `/block` · `/unblock` | în chatul unui contact: șterge istoricul / exclude / reinclude |
| `/kb` · `/kb set <text>` · `/kb add <text>` · `/kb clear` | knowledge base |
| `/prompt` · `/prompt set <text>` · `/prompt reset` | instrucțiunile agentului |
| `/learnStyle` | învață stilul tău de scriere |
| `/help` | lista comenzilor |

## Deploy
VPS Ubuntu cu Node 22 + PostgreSQL + systemd: vezi [`docs/DEPLOY_VPS.md`](docs/DEPLOY_VPS.md)
(include OpenRouter, alegerea modelelor free + fallback, configurarea agentului și depanare).
QR-ul de asociere apare în loguri (`journalctl -u whatsapp-ai -f -o cat`).

## Git
Un singur branch: `main`. Varianta SaaS veche (multi-tenant, Stripe, dashboard Next.js) e păstrată în tag-ul
`saas-final` (`git checkout saas-final` doar pentru consultare). Modificările noi: branch → PR → `main`.

## Documentație
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — flux și decizii non-evidente
- [`docs/ENV_VARS.md`](docs/ENV_VARS.md) — variabile de mediu
- [`docs/DEV_SETUP.md`](docs/DEV_SETUP.md) — dependențe, typecheck, teste
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md)

## Structură
```
apps/api/src
├── index.ts                 # boot: migrări + seed owner, pornire WhatsApp, oprire curată
├── config/                  # env (zod), database (pg + drizzle), owner (OWNER_ID)
├── db/                      # schema.ts + migration-statements.ts (source of truth)
└── modules/
    ├── whatsapp/            # session manager (Baileys), auth state în Postgres
    └── ai/                  # message.handler, llm.client (OpenRouter), comenzi, anti-flood
```

> Notă: utilizarea unui client WhatsApp neoficial (Baileys) încalcă, cel mai probabil, termenii WhatsApp
> și poate duce la blocarea numărului. Folosește-l pe propria răspundere.
