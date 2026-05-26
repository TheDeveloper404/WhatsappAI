# Setup domeniu waai.ro

## Ordinea pașilor

### 1. Cloudflare — adaugi domeniul

1. Cont pe **cloudflare.com** → `Add a Site` → `waai.ro` → plan **Free**
2. Cloudflare îți dă 2 nameservere (gen `aria.ns.cloudflare.com`)
3. Mergi la registrar (unde ai cumpărat `.ro`) → **Nameservers** → înlocuiești cu cele din Cloudflare
4. Aștepți 10–30 minute să se propage

---

### 2. Resend — verifici domeniul

1. Resend dashboard → **Domains** → `Add Domain` → `waai.ro`
2. Resend îți dă records DNS (SPF, DKIM, DMARC)
3. Le adaugi în **Cloudflare DNS** (copy-paste fiecare)
4. Dai **Verify** în Resend → devine verde în câteva minute

---

### 3. Vercel — adaugi domeniul custom

1. Vercel → proiectul tău → **Settings** → **Domains**
2. Adaugi `waai.ro` și `www.waai.ro`
3. Vercel îți dă un record `A` sau `CNAME`
4. Îl adaugi în **Cloudflare DNS**
5. **Important:** în Cloudflare, la acel record, setezi **Proxy = DNS only** (nor gri, nu portocaliu)

---

### 4. Cloudflare Email Routing — ca să primești pe `hi@waai.ro` (opțional)

1. Cloudflare → **Email** → **Email Routing** → Enable
2. `Create address` → `hi@waai.ro` → forward la `dev.workspacehub@gmail.com`
3. Cloudflare adaugă MX records automat

---

### 5. Actualizezi env vars

**Railway (backend):**
```
APP_URL=https://waai.ro
EMAIL_FROM=noreply@waai.ro
```

**Vercel (frontend):** `NEXT_PUBLIC_API_URL` rămâne URL-ul Railway — nu se schimbă.

---

### 6. Stripe — actualizezi webhook

1. Stripe → **Developers** → **Webhooks**
2. Updatezi endpoint URL dacă era cu alt domeniu
3. Verifici success/cancel URLs din checkout session

---

### Ordinea critică

```
Cloudflare nameservers
    → propagare (10–30 min)
        → Resend DNS records  ─┐
        → Vercel domain        ├─ în paralel
        → Email Routing        ─┘
            → env vars Railway + Vercel
                → test email înregistrare
                → test plată Stripe
```

---

### Reminder — Testare features noi în producție

Înainte să mergi live cu orice feature nou:

1. Lucrezi pe un branch separat (ex: `feature/nume-feature`)
2. Vercel face preview automat pe acel branch → testezi acolo
3. Railway: ai un serviciu `api-staging` cu DB separată → `NEXT_PUBLIC_API_URL` pe branch pointează la staging
4. Când totul e ok pe staging → merge pe `main` → deploy automat în producție

**Setup staging Railway (o singură dată, ~10 min):**
- Duplicate serviciul API în Railway → redenumești `api-staging`
- Setezi variabilele de env (aceleași, dar `DATABASE_URL` = o bază de date nouă separată)
- Pe Vercel, branch-ul `staging` primește `NEXT_PUBLIC_API_URL` = URL-ul `api-staging`
