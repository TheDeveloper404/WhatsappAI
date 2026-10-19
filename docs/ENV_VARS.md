# Variabile de mediu — WhatsApp AI (personal)

Fișier: `apps/api/.env` (vezi `apps/api/.env.example`). Valorile lăsate goale (`VAR=`) = nesetate.

| Variabilă | Obligatorie | Default | Descriere |
|---|---|---|---|
| `DATABASE_URL` | da | — | Connection string Postgres. |
| `OPENROUTER_API_KEY` | da | — | Cheie de la https://openrouter.ai/keys. |
| `LLM_MODEL` | nu | `google/gemini-2.5-flash` | Orice id de model OpenRouter (ex. `anthropic/claude-sonnet-4.5`). |
| `LLM_FALLBACK_MODEL` | recomandat | — | Model încercat dacă primul apel eșuează (429/5xx/timeout). Obligatoriu în practică dacă `LLM_MODEL` e `:free`. |
| `LLM_AUDIO_MODEL` | nu | — | Model OpenRouter cu input audio pentru vocale (ex. `google/gemini-2.5-flash-lite`). Lipsă → vocalele sunt ignorate. Modelele `:free` audio nu merg prin API (testat 2026-10-19). |
| `WHATSAPP_ENC_KEY` | recomandat | — | `openssl rand -hex 32`. Criptează creds-urile WhatsApp în DB (AES-256-GCM). |
| `OWNER_USER_ID` | nu | `owner` | Doar la migrarea unei baze SaaS existente (id-ul userului vechi). |
| `NODE_ENV` | nu | `production` | `development` local (loguri lizibile în loc de JSON). |
