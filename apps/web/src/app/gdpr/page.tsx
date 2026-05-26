import type { Metadata } from 'next'
import { BackButton } from '@/components/BackButton'
import { DeleteAccountButton } from '@/components/DeleteAccountButton'

export const metadata: Metadata = {
  title: 'GDPR — WhatsApp AI',
}

export default function GdprPage() {
  return (
    <main className="max-w-[760px] mx-auto px-6 py-20">
      <BackButton />

      <h1 className="font-display text-[48px] sm:text-[64px] text-ink mb-4">gdpr.</h1>
      <p className="font-mono-ui text-[11px] text-dimmer mb-12">Ultima actualizare: 25 mai 2026</p>

      <div className="space-y-10 text-[15px] text-dim leading-relaxed">

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Angajamentul nostru GDPR</h2>
          <p>WhatsApp AI SRL respectă Regulamentul (UE) 2016/679 (GDPR) și legislația națională de implementare. Această pagină explică în detaliu drepturile tale și modul în care le poți exercita.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Dreptul de acces (Art. 15)</h2>
          <p>Ai dreptul să obții confirmarea că prelucrăm date despre tine și, dacă da, o copie a acestor date împreună cu informații despre scopul, categoriile, destinatarii și durata prelucrării. Răspundem în termen de 30 de zile.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Dreptul la rectificare (Art. 16)</h2>
          <p>Poți solicita corectarea datelor inexacte sau completarea datelor incomplete. Modificările din cont (email, număr de telefon) pot fi făcute direct din dashboard fără a ne contacta.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Dreptul la ștergere (Art. 17)</h2>
          <p>Poți solicita ștergerea datelor tale când: nu mai sunt necesare pentru scopul colectării, îți retragi consimțământul, te opui prelucrării și nu există un interes legitim prevalent, sau datele au fost prelucrate ilegal. Ștergerea se efectuează în <strong className="text-ink">48 de ore</strong>, cu excepția datelor pe care suntem obligați legal să le păstrăm.</p>
          <div className="mt-6">
            <DeleteAccountButton />
          </div>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Dreptul la restricționare (Art. 18)</h2>
          <p>Poți solicita restricționarea prelucrării dacă: contești exactitatea datelor, prelucrarea este ilegală, avem nevoie de date pentru o acțiune legală chiar dacă nu mai sunt necesare pentru scopul inițial, sau ai obiectat la prelucrare.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Dreptul la portabilitate (Art. 20)</h2>
          <p>Poți primi datele furnizate de tine într-un format structurat, utilizat frecvent și lizibil automat (JSON/CSV) și le poți transmite unui alt operator. Această cerere o procesăm în 30 de zile.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Dreptul la opoziție (Art. 21)</h2>
          <p>Te poți opune prelucrării datelor în scopuri de marketing direct — efectul este imediat. Te poți opune și prelucrărilor bazate pe interesul nostru legitim; vom evalua și răspunde în 30 de zile.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Cum exerciți aceste drepturi</h2>
          <p>Trimite un email la <a href="mailto:hi@waai.ro" className="text-acid hover:underline">hi@waai.ro</a> cu subiectul &bdquo;Cerere GDPR&rdquo; și specifică dreptul pe care dorești să-l exerciți. Răspundem în maxim 30 de zile calendaristice. Serviciul este gratuit; în cazuri complexe sau repetitive putem solicita o taxă rezonabilă.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Autoritatea de supraveghere</h2>
          <p>Ai dreptul să depui o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP), cu sediul în București, B-dul Gheorghe Magheru nr. 28-30. Site: <span className="font-mono-ui text-[13px]">dataprotection.ro</span></p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Transferuri internaționale</h2>
          <p>Unii furnizori de servicii (ex. Groq pentru procesare AI) pot procesa date în afara SEE. Ne asigurăm că transferurile se realizează cu garanții adecvate: clauze contractuale standard aprobate de Comisia Europeană sau echivalent.</p>
        </section>

      </div>
    </main>
  )
}
