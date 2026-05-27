'use client'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'

function WaIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="#fff">
      <path d="M16 5.5C10.2 5.5 5.5 10.2 5.5 16c0 1.85.49 3.66 1.42 5.25L5.5 26.5l5.4-1.4A10.4 10.4 0 0 0 16 26.5c5.8 0 10.5-4.7 10.5-10.5S21.8 5.5 16 5.5zm0 19.1a8.6 8.6 0 0 1-4.4-1.2l-.31-.18-3.2.83.86-3.12-.2-.32A8.55 8.55 0 0 1 7.4 16a8.6 8.6 0 1 1 8.6 8.6zm4.7-6.43c-.26-.13-1.52-.75-1.76-.84-.24-.09-.41-.13-.58.13s-.66.84-.81 1.01c-.15.17-.3.19-.55.06-.26-.13-1.08-.4-2.06-1.27a7.72 7.72 0 0 1-1.43-1.77c-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.58-1.39-.79-1.9-.21-.5-.42-.43-.58-.44h-.49a.94.94 0 0 0-.68.32c-.23.26-.89.86-.89 2.1s.91 2.44 1.04 2.6c.13.17 1.79 2.73 4.34 3.82.61.26 1.08.42 1.45.54.61.19 1.16.16 1.6.1.49-.07 1.52-.62 1.73-1.22.21-.6.21-1.11.15-1.22-.06-.11-.24-.17-.5-.3z" />
    </svg>
  )
}

const CHAT_LINES = [
  { side: 'left',  text: 'Bună! Aveți disponibil azi?' },
  { side: 'right', text: 'Da, avem! La ce oră vii? 😊', agent: true },
  { side: 'left',  text: 'La 17:00 merge?' },
  { side: 'right', text: 'Perfectă ora, te aștept! ✓✓', agent: true },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-base">

      {/* ── LEFT PANEL ────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[46%] relative overflow-hidden p-12"
        style={{ background: '#0A0F0C' }}
      >
        {/* grid overlay */}
        <div className="absolute inset-0 gridlines opacity-30 pointer-events-none" />
        {/* glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none" style={{ background: 'rgba(200,251,74,0.06)' }} />

        {/* Logo */}
        <Link href="/" className="relative flex items-center gap-2.5 z-10">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full" style={{ background: '#25D366' }}>
            <WaIcon size={20} />
          </span>
          <span className="font-mono-ui text-[20px] font-semibold" style={{ color: '#E8E6E1' }}>
            wa<span style={{ color: '#C8FB4A' }}>ai.</span>
          </span>
        </Link>

        {/* Hero copy */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-10">
          <div className="font-mono-ui text-[11px] tracking-widest mb-6" style={{ color: '#C8FB4A' }}>
            → AGENT ACTIV
          </div>
          <h2 className="font-display text-[44px] lg:text-[52px] leading-none mb-6" style={{ color: '#E8E6E1' }}>
            răspunde ca tine.<br />
            <em className="not-italic" style={{ color: '#C8FB4A' }}>chiar când nu ești.</em>
          </h2>
          <p className="text-[14px] leading-relaxed max-w-[320px] mb-10" style={{ color: 'rgba(232,230,225,0.55)' }}>
            AI-ul tău analizează stilul tău de scriere și preia conversațiile când ești ocupat.
          </p>

          {/* Mini chat mockup */}
          <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(232,230,225,0.08)' }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: '#C8FB4A' }} />
              <span className="font-mono-ui text-[10px] tracking-widest" style={{ color: '#C8FB4A' }}>AGENT ACTIV · 0.6s</span>
            </div>
            {CHAT_LINES.map((line, i) => (
              <div key={i} className={`flex ${line.side === 'right' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`px-3 py-2 text-[12px] max-w-[80%] ${line.side === 'right' ? 'bubble-r' : 'bubble-l'}`}
                  style={line.side === 'right'
                    ? { background: 'rgba(200,251,74,0.15)', color: '#E8E6E1', border: '1px solid rgba(200,251,74,0.2)' }
                    : { background: 'rgba(255,255,255,0.06)', color: 'rgba(232,230,225,0.7)', border: '1px solid rgba(232,230,225,0.08)' }
                  }
                >
                  {line.text}
                  {line.agent && (
                    <span className="ml-1.5 font-mono-ui text-[9px] opacity-60">AI</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-8 flex gap-8">
            {[{ v: '7 zile', l: 'trial gratuit' }, { v: '60s', l: 'setup' }, { v: '99%', l: 'uptime' }].map(s => (
              <div key={s.l}>
                <div className="font-display text-[24px]" style={{ color: '#C8FB4A' }}>{s.v}</div>
                <div className="font-mono-ui text-[10px] mt-0.5" style={{ color: 'rgba(232,230,225,0.4)' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 font-mono-ui text-[10px]" style={{ color: 'rgba(232,230,225,0.25)' }}>
          © 2026 WhatsApp AI SRL · nu suntem afiliați cu Meta
        </p>
      </div>

      {/* ── RIGHT PANEL ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 sm:px-10 py-12 bg-base relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        {/* Mobile logo */}
        <Link href="/" className="lg:hidden flex items-center gap-2.5 mb-10">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full" style={{ background: '#25D366' }}>
            <WaIcon size={20} />
          </span>
          <span className="font-mono-ui text-[20px] font-semibold text-ink">
            wa<span className="text-acid">ai.</span>
          </span>
        </Link>

        {/* Form card */}
        <div className="w-full max-w-[420px]">
          <div className="card-elevated rounded-2xl p-8">
            {children}
          </div>

          {/* Back to landing */}
          <div className="mt-6 text-center">
            <Link href="/" className="inline-flex items-center gap-1.5 font-mono-ui text-[12px] text-dimmer hover:text-dim transition-colors">
              ← înapoi la landing
            </Link>
          </div>
        </div>
      </div>

    </div>
  )
}
