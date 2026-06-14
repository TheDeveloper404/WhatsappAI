import type { Metadata } from 'next'
import { BackButton } from '@/components/BackButton'

export const metadata: Metadata = {
  title: 'Termeni și condiții — waai.',
}

export default function TermeniPage() {
  return (
    <main className="max-w-[760px] mx-auto px-6 py-20 fade-in">
      <BackButton />

      <h1 className="font-display text-[36px] sm:text-[52px] text-ink mb-4">termeni și condiții.</h1>
      <p className="font-mono-ui text-[11px] text-dimmer mb-12">Ultima actualizare: 25 mai 2026</p>

      <div className="prose-custom space-y-10 text-[15px] text-dim leading-relaxed">

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">1. Acceptarea termenilor</h2>
          <p>Prin accesarea și utilizarea platformei waai (&bdquo;Serviciul&rdquo;), ești de acord să respecți și să fii obligat de acești Termeni și Condiții. Dacă nu ești de acord cu oricare dintre acești termeni, te rugăm să nu utilizezi Serviciul.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">2. Descrierea serviciului</h2>
          <p>waai este o platformă software care permite utilizatorilor să configureze un agent de inteligență artificială pentru a gestiona conversații pe WhatsApp în numele lor. Serviciul funcționează pe baza contului tău personal de WhatsApp și nu trimite mesaje nesolicitate (spam).</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">3. Eligibilitate</h2>
          <p>Serviciul este disponibil persoanelor fizice cu vârsta de cel puțin 18 ani și persoanelor juridice înregistrate legal. Prin utilizarea Serviciului, confirmi că îndeplinești aceste cerințe.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">4. Contul de utilizator</h2>
          <p>Ești responsabil pentru menținerea confidențialității credențialelor contului tău și pentru toate activitățile care au loc în contul tău. Ne notifici imediat în cazul oricărei utilizări neautorizate a contului.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">5. Utilizare acceptabilă</h2>
          <p>Nu vei utiliza Serviciul pentru:</p>
          <ul className="list-disc pl-5 space-y-1.5 mt-3">
            <li>Trimiterea de mesaje nesolicitate (spam) sau marketing în masă</li>
            <li>Activități ilegale sau frauduloase</li>
            <li>Colectarea datelor personale fără consimțământul explicit al persoanelor vizate</li>
            <li>Hărțuire, intimidare sau discriminare</li>
            <li>Orice activitate care încalcă Termenii de Serviciu WhatsApp / Meta</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">6. Plăți și abonamente</h2>
          <p>Serviciul este disponibil pe bază de abonament lunar sau anual. Prețurile sunt afișate în RON și includ TVA acolo unde este aplicabil. Plățile sunt procesate prin Stripe. Abonamentele se reînnoiesc automat; poți anula oricând din dashboard.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">7. Proprietate intelectuală</h2>
          <p>Serviciul și conținutul său original, caracteristicile și funcționalitățile sunt și vor rămâne proprietatea exclusivă a ACL Smart Software SRL. Utilizarea Serviciului nu îți conferă niciun drept de proprietate intelectuală asupra acestuia.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">8. Limitarea răspunderii</h2>
          <p>ACL Smart Software SRL nu este responsabilă pentru daune indirecte, incidentale sau consecvente rezultate din utilizarea sau incapacitatea de a utiliza Serviciul. Răspunderea noastră totală nu va depăși suma plătită de tine în ultimele 12 luni.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">9. Modificări ale termenilor</h2>
          <p>Ne rezervăm dreptul de a modifica acești termeni în orice moment. Te vom notifica prin email cu cel puțin 14 zile înainte de intrarea în vigoare a modificărilor semnificative. Utilizarea continuă a Serviciului după notificare constituie acceptarea noilor termeni.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">10. Legislație aplicabilă</h2>
          <p>Acești termeni sunt guvernați de legile României. Orice dispută în legătură cu Serviciul va fi soluționată de instanțele competente din București, România.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">11. Contact</h2>
          <p>Pentru întrebări referitoare la acești termeni, ne poți contacta la <a href="mailto:support@waai.ro" className="text-acid hover:underline">support@waai.ro</a>.</p>
        </section>

      </div>
    </main>
  )
}
