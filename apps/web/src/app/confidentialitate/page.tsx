import type { Metadata } from 'next'
import { BackButton } from '@/components/BackButton'

export const metadata: Metadata = {
  title: 'Politică de confidențialitate — waai.',
}

export default function ConfidentialitatePage() {
  return (
    <main className="max-w-[760px] mx-auto px-6 py-20 fade-in">
      <BackButton />

      <h1 className="font-display text-[36px] sm:text-[52px] text-ink mb-4">confidențialitate.</h1>
      <p className="font-mono-ui text-[11px] text-dimmer mb-12">Ultima actualizare: 25 mai 2026</p>

      <div className="space-y-10 text-[15px] text-dim leading-relaxed">

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">1. Cine suntem</h2>
          <p>ACL Smart Software SRL (care operează platforma &bdquo;waai&rdquo;), cu sediul în Str. Horea 2/31, Petroșani, România (CUI 51219715), este operatorul datelor cu caracter personal colectate prin intermediul platformei waai. Ne poți contacta la <a href="mailto:support@waai.ro" className="text-acid hover:underline">support@waai.ro</a>.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">2. Ce date colectăm</h2>
          <ul className="list-disc pl-5 space-y-1.5 mt-3">
            <li><strong className="text-ink">Date de cont:</strong> adresă de email, parolă (stocată sub formă de hash), număr de telefon</li>
            <li><strong className="text-ink">Date de utilizare:</strong> configurațiile agentului, stilul de scriere, prompturile personalizate</li>
            <li><strong className="text-ink">Date de plată:</strong> procesate exclusiv de Stripe — nu stocăm date ale cardului</li>
            <li><strong className="text-ink">Date tehnice:</strong> adresă IP, tipul browserului, paginile accesate, durata sesiunii</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">3. De ce colectăm datele</h2>
          <ul className="list-disc pl-5 space-y-1.5 mt-3">
            <li>Furnizarea și îmbunătățirea Serviciului</li>
            <li>Procesarea plăților și gestionarea abonamentelor</li>
            <li>Comunicări referitoare la cont (actualizări, notificări de securitate)</li>
            <li>Respectarea obligațiilor legale</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">4. Baza legală</h2>
          <p>Prelucrăm datele tale pe baza: executării contractului (furnizarea Serviciului), consimțământului tău (comunicări de marketing), interesului nostru legitim (securitate, prevenirea fraudelor) și obligației legale (facturare, raportări fiscale).</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">5. Cu cine partajăm datele</h2>
          <p>Nu vindem datele tale. Le partajăm doar cu:</p>
          <ul className="list-disc pl-5 space-y-1.5 mt-3">
            <li><strong className="text-ink">Stripe</strong> — procesare plăți</li>
            <li><strong className="text-ink">Google (Gemini), Groq</strong> — furnizori AI care procesează mesajele pentru generarea răspunsurilor (Gemini este furnizorul principal, Groq rezervă)</li>
            <li><strong className="text-ink">Autorități publice</strong> — când suntem obligați legal</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">6. Cât timp păstrăm datele</h2>
          <p>Datele de cont sunt păstrate pe durata abonamentului activ și 30 de zile după închiderea contului. Datele de facturare sunt păstrate 10 ani conform legislației fiscale din România. Datele tehnice de log sunt șterse după 90 de zile.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">7. Drepturile tale</h2>
          <p>Conform GDPR, ai dreptul la: acces, rectificare, ștergere, restricționarea prelucrării, portabilitatea datelor și opoziție. Poți exercita aceste drepturi la <a href="mailto:support@waai.ro" className="text-acid hover:underline">support@waai.ro</a>. Ai, de asemenea, dreptul de a depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP).</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">8. Securitate</h2>
          <p>Utilizăm măsuri tehnice și organizatorice adecvate pentru protejarea datelor tale: criptare în tranzit (TLS), criptare la stocare pentru date sensibile, parole stocate sub formă de hash, audituri periodice de securitate.</p>
        </section>

      </div>
    </main>
  )
}
