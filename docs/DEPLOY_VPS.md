# Deploy pe VPS (Ubuntu 24.04) — Node + PostgreSQL + systemd

Fără Docker și fără server web: aplicația e un singur proces Node care ține conexiunea WhatsApp,
pornit de systemd. Configurarea agentului se face din WhatsApp (comenzile `/help`).

> **O singură instanță.** Nu rula aplicația în două locuri cu același număr: WhatsApp închide una
> dintre conexiuni (cod 440), iar timer-ele de răspuns sunt în memorie.

## 0. Înainte: OpenRouter

1. Cont pe https://openrouter.ai → **Keys** → **Create Key** (începe cu `sk-or-v1-`). Cheia se pune DOAR
   în `apps/api/.env` pe VPS — niciodată în git, chat sau capturi de ecran. Dacă a fost expusă, revoc-o.
2. Alege modelele: https://openrouter.ai/models. Lista gratuită (id-uri cu sufixul `:free`) se schimbă des:
   ```powershell
   (Invoke-RestMethod https://openrouter.ai/api/v1/models).data | Where-Object { $_.id -like "*:free" } | Select-Object id, context_length
   ```
   Pentru WhatsApp alege un model de chat/instruct; evită modelele de cod, „reasoning", „safety" și cele foarte mici.
3. Modelele `:free` pot da des **429** (pool comun la provider, „temporarily rate-limited upstream").
   Pune mereu și un `LLM_FALLBACK_MODEL` — aplicația îl încearcă automat când primul pică. Cel mai sigur:
   fallback pe un model plătit ieftin, cu câțiva dolari credit în OpenRouter.

```env
LLM_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
LLM_FALLBACK_MODEL=google/gemma-4-31b-it:free      # sau un model plătit, ex. google/gemini-2.5-flash
```

## 1. Server (o singură dată)

```bash
sudo apt update && sudo apt -y upgrade
sudo apt install -y git curl postgresql

# Node.js 22 LTS (NodeSource) + pnpm prin corepack
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
node -v && pnpm -v

# Firewall: doar SSH (aplicația nu ascultă pe niciun port)
sudo ufw allow OpenSSH && sudo ufw --force enable
```

## 2. Baza de date

```bash
DB_PASS=$(openssl rand -hex 24); echo "$DB_PASS"     # notează-o: o folosești în .env la pasul 3
# (variabila se pierde dacă închizi sesiunea SSH — atunci o pui manual în DATABASE_URL)
sudo -u postgres psql -c "CREATE USER whatsapp WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "CREATE DATABASE whatsapp_ai OWNER whatsapp;"
```

Postgres ascultă implicit doar pe `localhost` — nu e expus în internet.

## 3. Cod + configurare

```bash
sudo mkdir -p /opt/whatsapp-ai && sudo chown $USER /opt/whatsapp-ai
git clone https://github.com/TheDeveloper404/WhatsappAI.git /opt/whatsapp-ai      # branch-ul main
cd /opt/whatsapp-ai
pnpm install --frozen-lockfile
pnpm build

cp apps/api/.env.example apps/api/.env
sed -i "s/^NODE_ENV=.*/NODE_ENV=production/" apps/api/.env
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://whatsapp:$DB_PASS@localhost:5432/whatsapp_ai|" apps/api/.env
sed -i "s/^WHATSAPP_ENC_KEY=.*/WHATSAPP_ENC_KEY=$(openssl rand -hex 32)/" apps/api/.env
nano apps/api/.env          # completează OPENROUTER_API_KEY, LLM_MODEL, LLM_FALLBACK_MODEL (vezi §0)
chmod 600 apps/api/.env
grep WHATSAPP_ENC_KEY apps/api/.env   # salveaz-o într-un password manager
```

Repo privat → la `git clone`, parola = un GitHub Personal Access Token (fine-grained, doar acest repo,
„Contents: Read").

## 4. Serviciul systemd

```bash
sed -i "s/^User=.*/User=$USER/" deploy/whatsapp-ai.service
sudo cp deploy/whatsapp-ai.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now whatsapp-ai
journalctl -u whatsapp-ai -f -o cat      # aici apare QR-ul
```

Scanează QR-ul: WhatsApp → **Dispozitive conectate** → **Conectează un dispozitiv** (dacă QR-ul arată
deformat, mărește fereastra terminalului sau micșorează fontul). Ieși din loguri cu Ctrl+C.
Apoi, în chatul cu tine însuți („Tu"): `/help`, `/activateAI`, `/status`.

Sesiunea e salvată criptat în Postgres → după restart/reboot se reconectează singură, fără QR.
Dacă QR-ul expiră nescanat (~5 cicluri) sau deconectezi dispozitivul din telefon:
`sudo systemctl restart whatsapp-ai` → QR nou în loguri.

## 4b. Configurarea agentului (din WhatsApp, chatul „Tu")

```
/prompt set Răspunzi în numele lui <nume>, <ce business>, când el nu e disponibil.
Ton: prietenos, scurt. Dacă nu știi ceva, spune că revine <nume>.

/kb set Program: L–V 9–18. Adresa: ... Prețuri: ...
/kb add <informație nouă>
/setTimer 5
/activateAI
/status
```

După ce ai trimis manual cel puțin 10 mesaje de pe numărul conectat: `/learnStyle`. Lista completă: `/help`.

## 5. Operare

```bash
systemctl status whatsapp-ai
journalctl -u whatsapp-ai -f -o cat             # loguri live
sudo systemctl restart whatsapp-ai

# Update la o versiune nouă — /opt/whatsapp-ai NU e repo git: se copiază fișierele schimbate de pe local.
# (de pe local) compară: md5sum <fișier> vs. `sudo md5sum /opt/whatsapp-ai/<fișier>` pe VPS
scp apps/api/src/modules/ai/<fișier>.ts ubuntu@VPS:/tmp/wa-upd.ts
# (pe VPS) backup + înlocuire + build + restart
F=/opt/whatsapp-ai/apps/api/src/modules/ai/<fișier>.ts
sudo cp -p $F /tmp/<fișier>.ts.bak && sudo install -o whatsapp -g whatsapp -m 644 /tmp/wa-upd.ts $F
sudo -u whatsapp bash -c "cd /opt/whatsapp-ai/apps/api && pnpm build" && sudo systemctl restart whatsapp-ai
# Dependențe schimbate (package.json/pnpm-lock.yaml) → copiază-le și pe ele, apoi `pnpm install --frozen-lockfile` înainte de build.

# Backup zilnic DB (crontab -e):
# 0 3 * * * pg_dump -Fc "postgresql://whatsapp:PAROLA@localhost/whatsapp_ai" > /opt/backups/wa-$(date +\%F).dump && find /opt/backups -name 'wa-*.dump' -mtime +14 -delete
sudo mkdir -p /opt/backups && sudo chown $USER /opt/backups

# Restore
pg_restore --clean --if-exists -d "postgresql://whatsapp:PAROLA@localhost/whatsapp_ai" /opt/backups/wa-YYYY-MM-DD.dump

# Shell SQL
psql "postgresql://whatsapp:PAROLA@localhost/whatsapp_ai"
```

## 5b. Probleme frecvente

| Simptom | Cauză / rezolvare |
|---|---|
| AI-ul nu răspunde, în loguri `OpenRouter HTTP 429` | Modelul free e aglomerat. Pune `LLM_FALLBACK_MODEL` (ideal plătit), apoi `sudo systemctl restart whatsapp-ai`. |
| `OpenRouter HTTP 401` | Cheie greșită/revocată în `.env`. |
| `Invalid environment variables` la pornire | Lipsește o variabilă obligatorie (`DATABASE_URL`, `OPENROUTER_API_KEY`) sau `WHATSAPP_ENC_KEY` are sub 32 caractere. |
| `Migration failed` | Postgres oprit sau parolă greșită în `DATABASE_URL`: `systemctl status postgresql`. |
| QR-ul nu mai apare | A expirat nescanat → `sudo systemctl restart whatsapp-ai`. |
| AI-ul nu răspunde, fără erori | `/status`: agent inactiv/în pauză? Ai scris tu în chat în ultimele N minute (timer)? Contact blocat? |
| Răspunsuri duble | Mai rulează o instanță veche (Railway/local) pe același număr — oprește-o. |

## 6. Migrare dintr-o instalare SaaS existentă (opțional)

1. `pg_dump -Fc` din baza veche → `pg_restore` în baza nouă (comanda de restore de mai sus).
2. Află id-ul contului tău: `SELECT id, email FROM users;` și pune-l în `apps/api/.env` ca `OWNER_USER_ID=<id>`.
3. Folosește **aceeași** `WHATSAPP_ENC_KEY` ca înainte, altfel sesiunea salvată nu se poate decripta.
4. Tabelele SaaS nefolosite rămân în bază, inofensive. Curățare opțională (ireversibil — fă backup):
   ```sql
   DROP TABLE IF EXISTS subscriptions, stripe_events, refresh_tokens, login_attempts, notifications,
     admin_audit_log, platform_config, ai_usage, lead_insights, order_items, orders,
     appointment_items, appointments, products, document_chunks, documents CASCADE;
   ```
