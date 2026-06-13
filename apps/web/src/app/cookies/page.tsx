import type { Metadata } from 'next'
import { BackButton } from '@/components/BackButton'
import { ScrollRestoreTop } from '@/components/ScrollRestoreTop'
import { CookieResetButton } from '@/components/CookieResetButton'

export const metadata: Metadata = {
  title: 'Politică de cookies — waai.',
}

export default function CookiesPage() {
  return (
    <main className="max-w-[760px] mx-auto px-6 py-20 fade-in">
      <ScrollRestoreTop />
      <BackButton />

      <h1 className="font-display text-[36px] sm:text-[52px] text-ink mb-4">cookies.</h1>
      <p className="font-mono-ui text-[11px] text-dimmer mb-12">Ultima actualizare: 25 mai 2026</p>

      <div className="space-y-10 text-[15px] text-dim leading-relaxed">

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Ce sunt cookie-urile</h2>
          <p>Cookie-urile sunt fișiere text mici stocate pe dispozitivul tău când vizitezi un site web. Ne ajută să îți oferim o experiență mai bună și să înțelegem cum este utilizat Serviciul nostru.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Cookie-uri strict necesare</h2>
          <p>Acestea sunt esențiale pentru funcționarea site-ului și nu pot fi dezactivate. Includ:</p>
          <ul className="list-disc pl-5 space-y-1.5 mt-3">
            <li><code className="font-mono-ui text-[13px] bg-cardhi px-1.5 py-0.5 rounded-sm">wa-ai-theme</code> — preferința de temă (light/dark), stocat în localStorage</li>
            <li><code className="font-mono-ui text-[13px] bg-cardhi px-1.5 py-0.5 rounded-sm">wa-ai-cookie-consent</code> — înregistrarea consimțământului tău pentru cookies</li>
            <li>Cookie-uri de sesiune pentru autentificare (JWT)</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Cookie-uri funcționale</h2>
          <p>Îți permit să utilizezi funcționalitățile avansate ale platformei. Fără acestea, unele funcții pot fi indisponibile. Stocăm preferințele de dashboard, configurațiile salvate și setările de notificări.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Cookie-uri analitice</h2>
          <p>Ne ajută să înțelegem cum interacționezi cu platforma pentru a o îmbunătăți. Datele sunt agregate și anonimizate. Poți refuza aceste cookie-uri fără a afecta funcționalitatea de bază.</p>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Durata de stocare</h2>
          <ul className="list-disc pl-5 space-y-1.5 mt-3">
            <li>Cookie-uri de sesiune — șterse la închiderea browserului</li>
            <li>Cookie-uri persistente — maxim 12 luni</li>
            <li>localStorage — până la ștergerea manuală sau resetarea browserului</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Cum controlezi cookie-urile</h2>
          <p>Poți modifica preferințele oricând din bannerul de cookies (apasă butonul de mai jos). De asemenea, poți configura browserul să blocheze sau să șteargă cookie-urile — consultă documentația browserului tău. Reține că dezactivarea cookie-urilor necesare poate afecta funcționarea platformei.</p>
          <CookieResetButton />
        </section>

        <section>
          <h2 className="font-display-md text-[22px] text-ink mb-3">Contact</h2>
          <p>Întrebări despre cookie-uri: <a href="mailto:support@waai.ro" className="text-acid hover:underline">support@waai.ro</a></p>
        </section>

      </div>
    </main>
  )
}
