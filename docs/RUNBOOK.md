# RUNBOOK — Proceduri Incident WhatsApp AI

## URLs Producție

| Serviciu | URL |
|----------|-----|
| Frontend (Vercel) | https://whatsapp-ai-web-rho.vercel.app |
| API (Railway) | https://api-production-2318d.up.railway.app |
| Health check | https://api-production-2318d.up.railway.app/health |

---

## 1. Restart API Railway

**Când:** API nu răspunde, health check pică, deploy blocat.

1. Railway dashboard → proiectul tău → serviciul **api**
2. Tab **Deployments** → ultimul deployment → buton **Restart**
3. Urmărești **Deploy Logs** — aștepți `[BOOT] API running on port 8080`
4. Verifici `https://api-production-xxx.railway.app/health` → `{"status":"ok"}`

**Dacă nu pornește:** verifică **Deploy Logs** pentru erori de migrare sau env vars lipsă.

---

## 2. Sesiuni WhatsApp pierdute

**Simptom:** userii raportează că WhatsApp s-a deconectat, QR code cerut din nou.

**Cauză posibilă:** restart Railway șterge sesiunile din memorie (normal — auth state e în Postgres).

**Pași:**
1. Userul deschide dashboard → pagina **WhatsApp** → **Conectează**
2. Scanează QR code cu telefonul
3. Sesiunea se restabilește automat

**Dacă QR nu apare:**
1. Verifică Railway logs pentru erori Baileys
2. Verifică că `DATABASE_URL` e setat corect în Railway env vars
3. Restart API (vezi secțiunea 1)

**Restaurare automată la startup:** API-ul apelează `restoreAllSessions()` la pornire — sesiunile active din Postgres sunt reconectate fără intervenție manuală.

---

## 3. Rollback Deploy

**Când:** un deploy nou a stricat ceva în producție.

1. Railway dashboard → serviciul **api** sau **web** → tab **Deployments**
2. Găsești ultimul deployment stabil (verde)
3. Click pe el → buton **Redeploy**
4. Aștepți să pornească și verifici că funcționează

**Pentru Vercel (frontend):**
1. Vercel dashboard → proiectul tău → **Deployments**
2. Găsești deployment-ul anterior stabil
3. Click **...** → **Promote to Production**

---

## 4. Erori de migrare DB la startup

**Simptom:** în Deploy Logs apare `[BOOT] Migration failed` repetat de 5 ori → `process.exit(1)`.

**Pași:**
1. Verifici că `DATABASE_URL` e setat în Railway env vars
2. Railway dashboard → serviciul **Postgres** → verifici că e **Active**
3. Dacă Postgres e pe plan Hobby, poate dormi — API-ul face retry de 5 ori cu 3s pauză; de obicei se rezolvă singur
4. Dacă persistă: Railway → Postgres → **Connect** → rulezi manual migrarea din `apps/api/src/db/migrate.ts`

---

## 5. Rate limiting — user blocat

**Simptom:** user primește 429 și nu poate face login sau alte acțiuni.

**Timpi de expirare:**
- Login: 5 încercări / 15 minute (per email + IP)
- Admin auth: 10 încercări / 15 minute
- WhatsApp connect: 5 / minut
- AI analyze-style: 3 / minut

**Rezolvare:** aștepți fereastra de timp să expire (max 15 minute). Nu există override manual fără restart API.

---

## 6. Ștergere cont user (GDPR — confirmare pe email)

**Cum funcționează:** userul cere ștergerea cu parola (`POST /users/me/deletion-request`) → primește email cu link → ștergerea devine definitivă **doar** la click pe link (`POST /users/me/deletion-confirm`). Nu mai există fereastră de 48h: dacă userul nu confirmă, linkul expiră în 1h și contul rămâne neatins.

**Anulare manuală a unei cereri pending** (înainte de confirmare) — invalidează linkul ștergând token-ul:

```sql
UPDATE users SET deletion_token = NULL, deletion_token_expiry = NULL WHERE email = 'email@user.com';
```

Rulezi în Railway → Postgres → **Query** sau prin orice client PostgreSQL cu `DATABASE_URL`.

> ⚠️ După confirmare (ștergere efectivă) **nu există recuperare** — datele sunt șterse definitiv (cascade pe FK).

---

## 7. Setare user admin

**Când:** trebuie să promovezi un user la rol admin pentru acces la `/admin`.

```sql
UPDATE users SET role = 'admin' WHERE email = 'email@admin.com';
```

---

## 8. Variabile de environment critice (Railway)

| Variabilă | Rol |
|-----------|-----|
| `DATABASE_URL` | Conexiune PostgreSQL |
| `JWT_ACCESS_SECRET` | Semnare access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | Semnare refresh tokens (min 32 chars) |
| `RESEND_API_KEY` | Trimitere emailuri |
| `STRIPE_SECRET_KEY` | Plăți |
| `STRIPE_WEBHOOK_SECRET` | Validare webhook Stripe |
| `GROQ_API_KEY` | AI (Groq LLM) |
| `APP_URL` | URL frontend (ex: `https://waai.ro`) |
| `ADMIN_SECRET` | PIN acces panou admin |
| `E2E_MODE` | **NU** seta `true` în producție |
