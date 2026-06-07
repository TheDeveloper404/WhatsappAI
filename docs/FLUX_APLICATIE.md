# Fluxul complet al aplicației — ghid din perspectiva owner-ului

> Document oficial. Descrie parcursul complet al unui antreprenor care folosește platforma WhatsApp AI:
> de la cont la conversații automate, cu exemple concrete de configurare în dashboard pentru mai multe
> tipuri de business (magazin online, frizerie, patiserie, agenție software).
> Reflectă funcționalitatea livrată la 2026-06-01.

---

## 0. Pe scurt — ce face aplicația

Owner-ul își conectează numărul de WhatsApp Business. Când nu răspunde el în câteva minute, **agentul AI
preia conversația**: răspunde clienților în stilul și tonul lui, oferă informații despre servicii/produse,
strânge detalii de comandă, califică lead-uri și îl anunță pe owner. Owner-ul controlează totul din
dashboard și prin comenzi trimise direct în WhatsApp.

Principiul de bază: **owner-ul are mereu prioritate.** AI-ul intervine doar când owner-ul tace.

---

## 1. Cont și abonament

1. **Înregistrare** cu email + parolă → verificare email.
2. **Trial** automat la creare (vezi badge „Trial activ" + zile rămase pe Dashboard).
3. **Abonament** din pagina *Abonament* (Stripe): plan lunar (49.99 lei) sau anual. La expirarea trial-ului
   apare un popup în dashboard. Plata, facturile și anularea se gestionează prin portalul Stripe.
4. **Ștergere cont** (GDPR) din pagina *Profil* → „Șterge contul": ceri ștergerea cu parola, primești un
   link de confirmare pe email, iar la click contul și toate datele se șterg definitiv (inclusiv conexiunea
   WhatsApp). Fără confirmarea pe email nu se șterge nimic.

---

## 2. Conectarea WhatsApp (o singură dată)

Pe **Dashboard** → panoul WhatsApp → **„Generează cod QR"**.
Pe telefon: **WhatsApp → Dispozitive conectate → Conectează un dispozitiv → scanează codul QR**.

- Starea trece din `Aștept scanare…` în **`Conectat`**.
- Recomandare: folosește un număr **dedicat de business**, nu cel personal.
- Dacă agentul e activ dar WhatsApp nu e conectat, dashboard-ul afișează un avertisment (mesajele rămân
  fără răspuns).

---

## 3. Configurarea agentului (Setări — 3 tab-uri)

Toată personalizarea stă în **Setări**, organizată în tab-urile **Agent**, **Conținut**, **Control**.

### 3.1 Tab „Agent" — comportament de bază
- **Stare agent** (activ/inactiv): comutatorul principal. Inactiv = AI-ul nu răspunde deloc.
- **Notificare când AI preia**: primești un mesaj pe WhatsApp când AI-ul a răspuns în locul tău.
- **Timer inactivitate (1–60 min)**: după câte minute de tăcere din partea ta intervine AI-ul.
  - Magazin aglomerat care vrea răspuns rapid: **2–3 min**.
  - Owner care preferă să răspundă el cât poate: **10–15 min**.
- **Monedă**: RON / EUR / USD / GBP. Se aplică la afișarea prețurilor (nu face conversie valutară).

### 3.2 Tab „Conținut" — ce știe și cum vorbește agentul
Aici e creierul agentului. Câmpuri, în ordine:

**a) System prompt** — cine e și cum se comportă (ton, limbă, reguli).
**b) Stilul meu de scriere** — agentul îți imită stilul. Poți apăsa **„Analizează automat"** (detectează
stilul din istoricul mesajelor tale, nevoie de min. 5 mesaje trimise) sau îl scrii manual.
**c) Informații despre business** (knowledge base) — servicii, produse, program, politici. Text liber.
**d) Documente (bază de cunoștințe / RAG)** — încarci PDF/DOCX/TXT (max 10 MB). Agentul caută automat în
ele și răspunde pe baza conținutului relevant. Ideal pentru cataloage, liste de prețuri, FAQ-uri lungi.
**e) Criterii calificare lead-uri** — ce înseamnă pentru tine un client potențial bun (folosit la scorarea
din pagina *Lead-uri*). Gol = criterii generice.
**f) Instrucțiuni colectare comandă** — ce informații trebuie strânse înainte de a propune o comandă.
Agentul le cere pe rând, firesc, și nu finalizează până nu le are.

### 3.3 Tab „Control" — control în timp real
- **Comenzi WhatsApp**: lista comenzilor pe care le trimiți de pe numărul conectat (vezi secțiunea 6).
- **Contacte ignorate**: numere pe care agentul nu le mai contactează automat (ex. familie, furnizori).

---

## 4. Catalogul de produse/servicii (pagina „Catalog produse")

Agentul oferă **doar** ce e în catalog, cu prețurile exacte de acolo. Pentru fiecare produs setezi:

| Câmp | Rol |
|------|-----|
| Nume, Descriere, Categorie | identificare |
| Preț | prețul afișat |
| Disponibil (toggle) | dacă agentul îl poate oferi |
| **Preț estimativ („de la")** (toggle) | **proiect custom**: agentul NU dă total fix, NU înregistrează comandă — strânge detalii și predă ofertarea ție |
| **Rezervabil** (toggle) | **serviciu pe programare**: agentul strânge serviciul + intervalul dorit + numele, creează o programare și predă ție confirmarea intervalului (nu „comandă") |
| Stoc | gol = nelimitat (servicii); număr = scade automat la comandă; 0 = epuizat |

Adăugare: manual (buton „Adaugă produs") sau **import CSV** (coloane: `nume`, `pret` obligatorii +
opțional `categorie`, `descriere`, `disponibil`, `estimativ`, `rezervabil`).

**Trei moduri de tranzacție, după cum marchezi produsul:**
- **Preț fix** (magazin, patiserie): agentul poate finaliza comanda. Clientul confirmă cu „da" → comandă
  înregistrată, total calculat, tu ești notificat.
- **Preț estimativ** (agenție, proiecte): agentul strânge cerințele, spune că „pregătește o ofertă
  personalizată, proprietarul revine cu prețul final", și îți trimite **„📌 Lead nou (ofertă custom)"**.
- **Rezervabil** (frizerie, clinică, salon): agentul strânge serviciul + intervalul dorit + numele, creează
  o programare *în așteptare*, spune clientului „proprietarul confirmă intervalul", și îți trimite
  **„📅 Programare nouă"**. Tu confirmi intervalul din pagina *Programări*.

---

## 5. Exemple concrete de configurare pe tip de business

### 5.1 Magazin online (preț fix)
- **System prompt:** „Ești asistentul magazinului X. Răspunzi scurt, prietenos. Ajuți la alegerea
  produselor și la plasarea comenzilor."
- **Catalog:** produse cu **preț fix**, stoc numeric (ex. „Tricou negru — 79 lei, stoc 40").
- **Instrucțiuni colectare comandă:** „Cere mărimea, culoarea, adresa de livrare și modalitatea de plată."
- **Monedă:** RON. **Timer:** 3 min.
- **Rezultat:** clientul comandă → agentul propune rezumat cu total → „da" → comandă înregistrată + stoc scăzut.

### 5.2 Frizerie / salon (programare)
- **System prompt:** „Ești recepția salonului Y. Programezi clienții și răspunzi la întrebări despre
  servicii și prețuri."
- **Catalog:** servicii marcate **Rezervabil**, preț fix, **stoc gol** (nelimitat): „Tuns — 50 lei",
  „Vopsit — 150 lei".
- **Instrucțiuni colectare comandă:** „Cere serviciul dorit, ziua și intervalul orar preferat, și numele."
- **Rezultat:** clientul cere o programare → agentul strânge serviciul + intervalul + numele → creează o
  programare *în așteptare*, îi spune că proprietarul confirmă intervalul, și îți trimite „📅 Programare
  nouă". Confirmi din pagina *Programări*. (Agentul NU confirmă singur ora — tu decizi slotul.)

### 5.3 Patiserie / cofetărie (comandă cu detalii)
- **System prompt:** „Ești asistentul cofetăriei Z. Iei comenzi de torturi și prăjituri."
- **Catalog:** preț fix pentru produse standard; **preț estimativ** pentru torturi personalizate.
- **Instrucțiuni colectare comandă:** „Pentru torturi cere: ocazia, numărul de porții, aroma, textul de pe
  tort și data ridicării."
- **Document RAG:** încarci lista completă de arome/alergeni ca PDF.

### 5.4 Agenție software / servicii pe proiect (preț estimativ)
- **System prompt:** „Ești consultantul agenției. Înțelegi nevoia clientului și pregătești drumul spre o
  ofertă personalizată."
- **Catalog:** servicii cu **preț estimativ („de la")**: „Aplicații web — de la 1000€", „AI/ML — de la 1500€".
- **Instrucțiuni colectare comandă:** checklist de discovery (tip serviciu, descriere proiect, buget, termen,
  persoană de contact).
- **Criterii lead:** „Lead bun = proiect clar + buget + termen + autoritate de decizie."
- **Rezultat:** agentul strânge tot, promite ofertă custom, NU dă preț final, îți trimite lead-ul.

---

> **Navigare dashboard:** meniul e grupat în 5 secțiuni — *Dashboard*, *Conversații* (cu tab Lead-uri),
> *Vânzări* (tab-uri Catalog · Comenzi · Programări), *Setări*, *Profil*. Pe desktop e o bară fixă în
> stânga; pe telefon, un meniu hamburger.

---

## 6. Operare zilnică

### 6.1 Cum intervine AI-ul
1. Clientul scrie. Dacă **răspunzi tu** în fereastra de timer → AI-ul tace.
2. Dacă **taci** peste timer → AI-ul preia, răspunde în stilul tău, și (dacă ai activat) te notifică.
3. Mesaje **urgente** sau de la **clienți frustrați** sunt semnalate prioritar în notificare.

### 6.2 Comenzi WhatsApp (de pe numărul conectat)
| Comandă | Efect |
|---------|-------|
| `/activateAI` · `/deactivateAI` | pornește / oprește agentul |
| `/pauseAI 2h` · `/resumeAI` | pauză X ore / reluare |
| `/setTimer 5min` | timer inactivitate (1–60 min) |
| `/status` | starea curentă a agentului |
| `/clearHistory` | șterge istoricul conversației curente |
| `/help` | lista comenzilor în WhatsApp |

### 6.3 Pagini de monitorizare
- **Conversații** — toate discuțiile în timp real (live), cu marcaj pentru mesajele trimise de AI.
- **Lead-uri** — contacte scorate (hot / warm / cold) după criteriile tale, cu justificare.
- **Comenzi** — comenzile înregistrate, cu status (în așteptare → confirmată → finalizată / anulată).
- **Programări** — cererile de programare la servicii rezervabile; confirmi intervalul, schimbi statusul
  (clientul e notificat pe WhatsApp la confirmare / anulare).
- **Dashboard** — statistici: mesaje, rată de rezolvare, escaladări, grafic pe 7 zile.

---

## 7. Garanții de comportament (de ce poți avea încredere)

- **Onestitate:** agentul nu afirmă acțiuni neexecutate („am trimis", „am înregistrat") decât dacă sistemul
  i-a confirmat real; nu inventează prețuri, termene, persoane sau discuții.
- **Doar din catalog:** nu oferă produse inexistente, indisponibile sau epuizate; prețurile sunt cele exacte.
- **Banii din cod, nu din AI:** totalurile se calculează în sistem, nu de model; stocul scade atomic la
  confirmare (fără supravânzare).
- **Pe subiect:** un filtru de scope ține conversația pe business și respinge încercările de a-i schimba rolul.
- **Confidențialitate:** datele fiecărui cont sunt izolate; conținutul sensibil nu apare în loguri.

---

## 8. Unde mergem mai departe
Funcționalitățile planificate (necesare / nice-to-have / pe viitor) sunt în `docs/BACKLOG.md`.
Fluxul de programare (N1) este acum livrat ca **handoff ușor**; pasul următor opțional este programarea
cu **disponibilitate completă** (program de lucru, calcul sloturi, anti dublă-rezervare, calendar) — B6.
