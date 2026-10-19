# Variabile de mediu — WhatsApp AI (personal)

Local: `apps/api/.env` (vezi `apps/api/.env.example`). Docker/VPS: `.env` în rădăcină (vezi `.env.example`).

| Variabilă | Obligatorie | Default | Descriere |
|---|---|---|---|
| `DATABASE_URL` | da | — | Connection string Postgres. În docker compose e construit automat din `POSTGRES_PASSWORD`. |
| `OPENROUTER_API_KEY` | da | — | Cheie de la https://openrouter.ai/keys. |
| `LLM_MODEL` | nu | `google/gemini-2.5-flash` | Orice id de model OpenRouter (ex. `anthropic/claude-sonnet-4.5`). |
| `LLM_FALLBACK_MODEL` | nu | — | Model încercat dacă primul apel eșuează (429/5xx/timeout). |
| `GROQ_API_KEY` | nu | — | Transcriere mesaje vocale cu Groq Whisper. Lipsă → vocalele sunt ignorate. |
| `WHATSAPP_ENC_KEY` | recomandat | — | `openssl rand -hex 32`. Criptează creds-urile WhatsApp în DB (AES-256-GCM). |
| `DASHBOARD_PASSWORD` | nu | — | Min. 12 caractere. Activează dashboard-ul web (HTTP Basic). Lipsă → doar QR în loguri. |
| `TRUST_PROXY_HOPS` | nu | `1` | Nr. de proxy-uri în față (Caddy/cloudflared = 1). |
| `OWNER_USER_ID` | nu | `owner` | Doar la migrarea unei baze SaaS existente (id-ul userului vechi). |
| `NODE_ENV` | nu | `production` | `development` local. |
| `PORT` | nu | `3001` | |
| `POSTGRES_PASSWORD` | da (compose) | — | Doar pentru docker compose. Folosește hex (intră în URL). |
| `DOMAIN` | profil caddy | — | Domeniul dashboard-ului pentru HTTPS automat. |
| `CLOUDFLARE_TUNNEL_TOKEN` | profil tunnel | — | Token tunel din Cloudflare Zero Trust. |
