'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const CONSENT_KEY = 'wa-ai-cookie-consent'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) setVisible(true)
    } catch {}
  }, [])

  function accept() {
    try { localStorage.setItem(CONSENT_KEY, 'accepted') } catch {}
    setVisible(false)
  }

  function decline() {
    try { localStorage.setItem(CONSENT_KEY, 'necessary') } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-line px-6 py-4 sm:py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6"
      style={{ background: 'var(--bg)' }}>
      <div className="flex-1">
        <p className="text-[13.5px] text-dim leading-relaxed">
          Folosim cookie-uri strict necesare pentru funcționarea platformei și, cu acordul tău, cookie-uri analitice pentru a o îmbunătăți.{' '}
          <Link href="/cookies" className="text-acid hover:underline font-mono-ui text-[12px]">
            politică cookies
          </Link>
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={accept}
          className="font-mono-ui text-[12.5px] bg-acid px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity"
          style={{ color: 'var(--on-acid)' }}
        >
          accept toate
        </button>
        <button
          onClick={decline}
          className="font-mono-ui text-[12.5px] border border-line text-dim px-5 py-2.5 rounded-full hover:bg-cardhi hover:text-ink transition-colors"
        >
          doar necesare
        </button>
      </div>
    </div>
  )
}
