# Deploy pe VPS (Ubuntu 24.04) — Node + PostgreSQL + systemd

Fără Docker și fără server web: aplicația e un singur proces Node care ține conexiunea WhatsApp,
pornit de systemd. Configurarea agentului se face din WhatsApp (comenzile `/help`).

> **O singură instanță.** Nu rula aplicația în două locuri cu același număr: WhatsApp închide una
> dintre conexiuni (cod 440), iar timer-ele de răspuns sunt în memorie.

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
DB_PASS=$(openssl rand -hex 24); echo "$DB_PASS"     # o folosești în .env la pasul 3
sudo -u postgres psql -c "CREATE USER whatsapp WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "CREATE DATABASE whatsapp_ai OWNER whatsapp;"
```

Postgres ascultă implicit doar pe `localhost` — nu e expus în internet.

## 3. Cod + configurare

```bash
sudo mkdir -p /opt/whatsapp-ai && sudo chown $USER /opt/whatsapp-ai
git clone -b personal https://github.com/TheDeveloper404/WhatsappAI.git /opt/whatsapp-ai
cd /opt/whatsapp-ai
pnpm install --frozen-lockfile
pnpm build

cp apps/api/.env.example apps/api/.env
sed -i "s/^NODE_ENV=.*/NODE_ENV=production/" apps/api/.env
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://whatsapp:$DB_PASS@localhost:5432/whatsapp_ai|" apps/api/.env
sed -i "s/^WHATSAPP_ENC_KEY=.*/WHATSAPP_ENC_KEY=$(openssl rand -hex 32)/" apps/api/.env
nano apps/api/.env          # completează OPENROUTER_API_KEY (și opțional LLM_MODEL, GROQ_API_KEY)
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

## 5. Operare

```bash
systemctl status whatsapp-ai
journalctl -u whatsapp-ai -f -o cat             # loguri live
sudo systemctl restart whatsapp-ai

# Update la o versiune nouă
cd /opt/whatsapp-ai && git pull && pnpm install --frozen-lockfile && pnpm build && sudo systemctl restart whatsapp-ai

# Backup zilnic DB (crontab -e):
# 0 3 * * * pg_dump -Fc "postgresql://whatsapp:PAROLA@localhost/whatsapp_ai" > /opt/backups/wa-$(date +\%F).dump && find /opt/backups -name 'wa-*.dump' -mtime +14 -delete
sudo mkdir -p /opt/backups && sudo chown $USER /opt/backups

# Restore
pg_restore --clean --if-exists -d "postgresql://whatsapp:PAROLA@localhost/whatsapp_ai" /opt/backups/wa-YYYY-MM-DD.dump

# Shell SQL
psql "postgresql://whatsapp:PAROLA@localhost/whatsapp_ai"
```

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
