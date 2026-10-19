# Deploy pe VPS (Ubuntu 22.04 / 24.04) — Docker Compose + Postgres

Stack: `db` (Postgres 16) + `api` (Fastify + Baileys) și, opțional, `caddy` (HTTPS public) sau
`cloudflared` (Cloudflare Tunnel, fără porturi deschise). API-ul ascultă doar pe `127.0.0.1:3001`.

> **O singură instanță.** Nu porni două containere `api` pe aceeași bază: WhatsApp acceptă o singură
> conexiune per dispozitiv asociat (a doua o închide pe prima — cod 440), iar timer-ele de răspuns sunt în RAM.

## 1. Pregătire server (o singură dată)

```bash
# Docker Engine + plugin compose (scriptul oficial Docker)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
docker compose version

# Firewall: doar SSH (+ 80/443 dacă folosești Caddy)
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp      # DOAR pentru varianta Caddy
sudo ufw enable
```

> Atenție: porturile publicate de Docker (`80:80`, `443:443`) ocolesc regulile ufw. `api` e publicat
> doar pe `127.0.0.1`, deci nu e expus; `db` nu e publicat deloc.

## 2. Cod + configurare

```bash
sudo mkdir -p /opt/whatsapp-ai && sudo chown $USER /opt/whatsapp-ai
git clone -b <branch> https://github.com/TheDeveloper404/WhatsappAI.git /opt/whatsapp-ai
cd /opt/whatsapp-ai

cp .env.example .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
sed -i "s/^WHATSAPP_ENC_KEY=.*/WHATSAPP_ENC_KEY=$(openssl rand -hex 32)/" .env
nano .env        # completează OPENROUTER_API_KEY, LLM_MODEL, DASHBOARD_PASSWORD (+ DOMAIN sau CLOUDFLARE_TUNNEL_TOKEN)
chmod 600 .env
```

Salvează `WHATSAPP_ENC_KEY` și într-un password manager: fără ea, sesiunea WhatsApp din DB nu mai
poate fi decriptată (trebuie reasociat telefonul).

## 3. Pornire — alege o variantă

```bash
# A) Doar local + SSH tunnel (cel mai sigur, nimic public):
docker compose up -d --build
#   de pe laptop: ssh -L 3001:127.0.0.1:3001 user@vps  → http://localhost:3001

# B) HTTPS public cu Caddy (record DNS A: DOMAIN → IP VPS):
docker compose --profile caddy up -d --build

# C) Cloudflare Tunnel (fără porturi deschise). În Zero Trust → Networks → Tunnels: creează tunel
#    „Cloudflared", copiază token-ul în CLOUDFLARE_TUNNEL_TOKEN, iar la Public Hostname setează
#    Service = http://api:3001.
docker compose --profile tunnel up -d --build
```

## 4. Asociere WhatsApp (QR)

```bash
docker compose logs -f api      # QR-ul apare în terminal la prima pornire
```

Sau deschide dashboard-ul (`/`, user oricare + `DASHBOARD_PASSWORD`) și scanează QR-ul de acolo:
WhatsApp → **Dispozitive conectate** → **Conectează un dispozitiv**. Apoi, din chatul cu tine însuți
(„Tu"), trimite `/activateAI` și `/status`.

Sesiunea se salvează criptat în Postgres → la restart/redeploy se reconectează singură.

## 5. Operare

```bash
docker compose ps
docker compose logs -f --tail=200 api
docker compose restart api

# Update la o versiune nouă
git pull && docker compose up -d --build        # (+ --profile caddy / tunnel, ca la pornire)
docker image prune -f

# Backup zilnic DB (crontab -e):
# 0 3 * * * cd /opt/whatsapp-ai && docker compose exec -T db pg_dump -U whatsapp -Fc whatsapp_ai > /opt/backups/wa-$(date +\%F).dump && find /opt/backups -name 'wa-*.dump' -mtime +14 -delete
mkdir -p /opt/backups

# Restore
docker compose exec -T db pg_restore -U whatsapp -d whatsapp_ai --clean --if-exists < /opt/backups/wa-YYYY-MM-DD.dump

# Shell SQL
docker compose exec db psql -U whatsapp -d whatsapp_ai
```

## 6. Migrare dintr-o instalare SaaS existentă (opțional)

1. `pg_dump -Fc` din baza veche → `pg_restore` în containerul `db` (comanda de restore de mai sus).
2. Află id-ul contului tău: `SELECT id, email FROM users;` și pune-l în `.env` ca `OWNER_USER_ID=<id>`
   (altfel seed-ul userului `owner` pică pe coloana veche `users.email NOT NULL`).
3. Folosește **aceeași** `WHATSAPP_ENC_KEY` ca înainte, altfel sesiunea salvată nu se poate decripta.
4. Tabelele SaaS nefolosite rămân în bază, inofensive. Curățare opțională (ireversibil — fă backup):
   ```sql
   DROP TABLE IF EXISTS subscriptions, stripe_events, refresh_tokens, login_attempts, notifications,
     admin_audit_log, platform_config, ai_usage, lead_insights, order_items, orders,
     appointment_items, appointments, products, document_chunks, documents CASCADE;
   ```
