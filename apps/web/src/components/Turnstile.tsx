'use client'
import { useEffect, useRef } from 'react'

// Cheia publică a widget-ului Turnstile (legată de hostname — nu e secretă). Overridabilă din env.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '0x4AAAAAADewooMRYw6Vs-m_'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
      remove: (id?: string) => void
    }
  }
}

// Încărcăm scriptul o singură dată pe pagină. Injectat dinamic din bundle-ul nostru (de încredere
// prin nonce) → permis de CSP-ul cu strict-dynamic chiar dacă vine de pe alt host.
let scriptPromise: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Turnstile script failed to load'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

interface Props {
  onToken: (token: string) => void
  onExpire?: () => void
}

// Widget Turnstile în mod „managed" (invizibil pentru userii reali; provocare doar pt boți suspecți).
export function Turnstile({ onToken, onExpire }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  // Ref-uri la callback-uri ca efectul să ruleze O SINGURĂ dată (altfel re-randăm widget-ul la fiecare render).
  const cbToken = useRef(onToken)
  cbToken.current = onToken
  const cbExpire = useRef(onExpire)
  cbExpire.current = onExpire

  useEffect(() => {
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile || widgetId.current) return
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => cbToken.current(token),
          'expired-callback': () => cbExpire.current?.(),
          'error-callback': () => cbExpire.current?.(),
        })
      })
      .catch(() => { /* fail-soft pe frontend; backend-ul respinge oricum lipsa token-ului */ })
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current) } catch { /* noop */ }
        widgetId.current = null
      }
    }
  }, [])

  return <div ref={ref} />
}
