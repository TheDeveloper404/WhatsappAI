# AI Feedback Log — WhatsApp AI Project

Acest fișier documentează greșelile AI și regulile stabilite în urma lor.
**Nu modifica `Claude_Development_Rules/` — documentația separată merge aici.**

---

## Format intrare

```
---
Data: YYYY-MM-DD
Ce s-a întâmplat: [descriere]
Regula încălcată: [care regulă, din care document]
Acțiune corectivă: [ce s-a stabilit]
---
```

---

## Intrări

---
Data: 2026-05-21
Ce s-a întâmplat: AI a modificat simultan mai multe fișiere E2E fără să testeze între schimbări. A intrat în loop de regresii (fix A strică B, fix B strică A). Nu a creat fișier de tracking de la început. Nu a citit Claude_Development_Rules la startul sesiunii. A declarat "testele ar trebui să treacă" fără output real din terminal.
Regula încălcată: Rule 11 (Oprește loop-ul), Rule 9 (Nu raporta teste neruate), Rule 10 (Urmărește fiecare schimbare explicit) — toate din SYSTEM_PROMPT.md; WORKFLOW.md Step 1 (Load the Right Documents).
Acțiune corectivă: Creat TRACKING.md în apps/e2e/. Protocol stabilit: TESTEZI → VEZI CE PICĂ → MODIFICI UN SINGUR LUCRU → TESTEZI. AI nu rulează teste — doar dă comanda utilizatorului.
---

---
Data: 2026-05-21
Fix test 18 (auth.spec.ts:80): getByText(/Email verificat|verificat|activ/i) → getByRole('heading', { name: /Email verificat/i })
Motiv: strict mode violation — regex găsea 2 elemente (h2 + p). Heading-ul e unic.
---

---
Data: 2026-05-21
Fix test 28 (auth.spec.ts:171): adăugat fill pentru câmpul "Confirmă parola" în reset-password form.
Motiv: pagina are 2 câmpuri (Parolă nouă + Confirmă parola). Testul completa doar primul → password !== confirmPassword → form returna fără API call → pagina rămânea pe loc.
---

---
Data: 2026-05-21
Ce s-a întâmplat: AI a modificat FEEDBACK_LOG.md din Claude_Development_Rules — folder care nu trebuie atins.
Regula încălcată: Regula nouă stabilită de user: Claude_Development_Rules/ este READ-ONLY. Documentația separată merge în docs/.
Acțiune corectivă: Revenit la originalul FEEDBACK_LOG.md. Creat docs/ pentru documentație proprie.
---
