'use client'

import { useRouter } from 'next/navigation'

export function BackButton() {
  const router = useRouter()

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault()
    // Întoarcere SPA, instant, fără reload → fără flash de hero. Next restaurează poziția de scroll
    // (ajungi unde erai, ex. footer-ul). Dacă pagina a fost deschisă direct (fără istoric în tab),
    // `history.length` e 1 → fallback la landing.
    if (window.history.length > 1) router.back()
    else router.push('/')
  }

  return (
    // `href` e doar fallback semantic/accesibilitate; navigarea reală se face JS-driven (router.back).
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      href="/"
      onClick={handleBack}
      className="font-mono-ui text-[12px] text-dimmer hover:text-ink transition-colors mb-10 inline-block"
    >
      ← înapoi
    </a>
  )
}
