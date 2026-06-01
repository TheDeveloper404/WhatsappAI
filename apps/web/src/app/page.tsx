'use client'
import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Moon, Sun, Menu, X, ArrowRight, Check, Play, ChevronUp,
  FileText, Flame, ShoppingCart,
} from 'lucide-react'

// ─── THEME HOOK ───────────────────────────────────────────────────────────────
function useTheme() {
  const [dark, setDark] = useState(false)
  useEffect(() => { setDark(document.documentElement.classList.contains('dark')) }, [])
  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('wa-ai-theme', next ? 'dark' : 'light') } catch {}
  }
  return { dark, toggle }
}

// ─── WA ICON ─────────────────────────────────────────────────────────────────
function WaIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="#fff">
      <path d="M16 5.5C10.2 5.5 5.5 10.2 5.5 16c0 1.85.49 3.66 1.42 5.25L5.5 26.5l5.4-1.4A10.4 10.4 0 0 0 16 26.5c5.8 0 10.5-4.7 10.5-10.5S21.8 5.5 16 5.5zm0 19.1a8.6 8.6 0 0 1-4.4-1.2l-.31-.18-3.2.83.86-3.12-.2-.32A8.55 8.55 0 0 1 7.4 16a8.6 8.6 0 1 1 8.6 8.6zm4.7-6.43c-.26-.13-1.52-.75-1.76-.84-.24-.09-.41-.13-.58.13s-.66.84-.81 1.01c-.15.17-.3.19-.55.06-.26-.13-1.08-.4-2.06-1.27a7.72 7.72 0 0 1-1.43-1.77c-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.58-1.39-.79-1.9-.21-.5-.42-.43-.58-.44h-.49a.94.94 0 0 0-.68.32c-.23.26-.89.86-.89 2.1s.91 2.44 1.04 2.6c.13.17 1.79 2.73 4.34 3.82.61.26 1.08.42 1.45.54.61.19 1.16.16 1.6.1.49-.07 1.52-.62 1.73-1.22.21-.6.21-1.11.15-1.22-.06-.11-.24-.17-.5-.3z" />
    </svg>
  )
}

// ─── NAVBAR ──────────────────────────────────────────────────────────────────
function Navbar() {
  const { dark, toggle } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-[1360px]">
      <div
        className="flex items-center justify-between h-16 px-5 sm:px-6 rounded-full backdrop-blur-xl border border-line"
        style={{ background: 'color-mix(in oklab, var(--bg) 80%, transparent)' }}
      >
        <a href="#top" className="flex items-center gap-2 pl-0.5">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full" style={{ background: '#25D366' }}>
            <WaIcon size={20} />
          </span>
          <span className="font-mono-ui text-[22px] tracking-tight font-semibold text-ink">
            wa<span className="text-acid">ai.</span>
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-7 text-[15px] text-dim font-mono-ui">
          <a href="#how"      className="hover:text-ink transition-colors pb-0.5 border-b border-transparent hover:border-acid">cum.merge</a>
          <a href="#features" className="hover:text-ink transition-colors pb-0.5 border-b border-transparent hover:border-acid">funcționalități</a>
          <a href="#diff"     className="hover:text-ink transition-colors pb-0.5 border-b border-transparent hover:border-acid">highlights</a>
          <a href="#pricing"  className="hover:text-ink transition-colors pb-0.5 border-b border-transparent hover:border-acid">prețuri</a>
          <a href="#faq"      className="hover:text-ink transition-colors pb-0.5 border-b border-transparent hover:border-acid">faq</a>
        </nav>

        <div className="flex items-center gap-1.5">
          <button onClick={toggle} aria-label="Toggle dark mode"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-line text-dim hover:text-ink transition-colors">
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <Link href="/login" className="hidden sm:inline-flex items-center text-[13px] text-dim hover:text-ink px-3 py-2 font-mono-ui transition-colors">
            login
          </Link>
          <Link href="/signup"
            className="inline-flex items-center gap-1.5 bg-acid font-medium text-[13px] px-4 py-2 rounded-full font-mono-ui hover:opacity-90 transition-opacity"
            style={{ color: 'var(--on-acid)' }}>
            începe →
          </Link>
          <button onClick={() => setOpen(!open)} className="md:hidden text-dim hover:text-ink p-2">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-2 rounded-2xl border border-line backdrop-blur-xl px-5 py-5 flex flex-col gap-3 font-mono-ui text-[14px]"
          style={{ background: 'color-mix(in oklab, var(--bg) 95%, transparent)' }}>
          {[
            { href: '#how',      label: 'cum.merge' },
            { href: '#features', label: 'funcționalități' },
            { href: '#diff',     label: 'highlights' },
            { href: '#pricing',  label: 'prețuri' },
            { href: '#faq',      label: 'faq' },
          ].map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-dim hover:text-ink py-1 transition-colors">{l.label}</a>
          ))}
          <div className="pt-3 border-t border-line flex flex-col gap-2">
            <Link href="/login" className="text-dim hover:text-ink py-1">login</Link>
            <Link href="/signup" className="bg-acid text-center py-2.5 rounded-full font-medium" style={{ color: 'var(--on-acid)' }}>
              începe →
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

// ─── HERO ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative pt-32 sm:pt-36 lg:pt-44 pb-20 lg:pb-28 text-center">
      <div className="absolute inset-0 gridlines gridlines-mask opacity-50 pointer-events-none" />
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: 'color-mix(in oklab, var(--acid) 8%, transparent)' }} />

      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 relative">
        {/* Announcement chip */}
        <div className="flex justify-center mb-10">
          <a href="#diff" className="inline-flex items-center gap-2 font-mono-ui text-[11.5px] tracking-wide px-3 py-1.5 rounded-full border border-line backdrop-blur text-dim hover:text-ink transition-colors"
            style={{ background: 'color-mix(in oklab, var(--bg) 60%, transparent)' }}>
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-acid pulse-dot" />
            </span>
            Versiunea 1.1 · fii primul din nișa ta
            <span className="text-dimmer">→</span>
          </a>
        </div>

        {/* Headline — big centered */}
        <h1 className="font-display text-[38px] sm:text-[80px] lg:text-[112px] text-ink mx-auto max-w-[960px]">
          nu mai pierde clienți<br />
          când nu <em className="not-italic text-acid">răspunzi.</em>
        </h1>

        <p className="mt-8 text-[18px] text-dim max-w-[560px] mx-auto leading-relaxed">
          Agentul AI care preia conversațiile, comenzile și programările pe WhatsApp — în stilul brandului tău, non-stop.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup"
            className="group inline-flex items-center gap-2 bg-acid font-medium text-[16px] pl-6 pr-2 py-3.5 rounded-full hover:opacity-90 transition-opacity"
            style={{ color: 'var(--on-acid)' }}>
            începe gratuit
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full" style={{ background: 'rgba(10,15,12,0.12)' }}>
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
          <a href="#console"
            className="inline-flex items-center gap-2 border border-line text-ink font-medium text-[16px] px-5 py-3.5 rounded-full hover:bg-cardhi transition-colors">
            <Play className="w-4 h-4 text-acid" />
            vezi un demo · 90s
          </a>
        </div>

        {/* Trust bar */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5 font-mono-ui text-[11.5px] text-dimmer">
          <span>✓ card necesar pentru trial</span>
          <span className="hidden sm:inline">·</span>
          <span>✓ setare 4 min</span>
          <span className="hidden sm:inline">·</span>
          <span>✓ datele tale sunt în siguranță</span>
          <span className="hidden sm:inline">·</span>
          <span>✓ anulezi cu un click</span>
        </div>
      </div>
    </section>
  )
}

// ─── OPERATOR CONSOLE ─────────────────────────────────────────────────────────
const LIVE_CHAT: { side: 'left' | 'right'; text: string }[] = [
  { side: 'left',  text: 'Salut! Mai e liber apartamentul din Cotroceni?' },
  { side: 'left',  text: 'Aș putea veni mâine la vizionare 🙏' },
  { side: 'right', text: 'hei, da e liber. mâine la 17 sau 18? îți pică ok?' },
  { side: 'left',  text: '17 e perfect' },
  { side: 'right', text: 'super! te-am trecut pt mâine la 17 👊' },
]

const OPERATOR_TIME_ZONE = 'Europe/Bucharest'

function formatOperatorTime(date: Date) {
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: OPERATOR_TIME_ZONE,
    timeZoneName: 'short',
  }).formatToParts(date)

  const hour = timeParts.find(part => part.type === 'hour')?.value ?? '00'
  const minute = timeParts.find(part => part.type === 'minute')?.value ?? '00'
  const zone = timeParts.find(part => part.type === 'timeZoneName')?.value ?? ''
  const weekday = new Intl.DateTimeFormat('ro-RO', {
    weekday: 'long',
    timeZone: OPERATOR_TIME_ZONE,
  }).format(date)

  return `${hour}:${minute} ${zone} \u00b7 ${weekday} \u2193`
}

function OperatorConsole() {
  const [shown, setShown] = useState(2)
  const [typing, setTyping] = useState(true)
  const [operatorTime, setOperatorTime] = useState('')

  useEffect(() => {
    let cur = 2
    let tid: ReturnType<typeof setTimeout> | null = null
    const advance = () => {
      const next = cur + 1
      if (next > LIVE_CHAT.length) {
        setTyping(false)
        tid = setTimeout(() => { cur = 2; setShown(2); setTyping(true); tid = null }, 2000)
        return
      }
      cur = next
      if (LIVE_CHAT[cur - 1].side === 'right') {
        setTyping(true)
        tid = setTimeout(() => { setTyping(false); setShown(cur); tid = null }, 900)
      } else {
        setTyping(false)
        setShown(cur)
      }
    }
    const id = setInterval(advance, 2200)
    return () => { clearInterval(id); if (tid) clearTimeout(tid) }
  }, [])

  useEffect(() => {
    const updateTime = () => setOperatorTime(formatOperatorTime(new Date()))

    updateTime()
    const id = setInterval(updateTime, 1000)

    return () => clearInterval(id)
  }, [])

  return (
    <section id="console" className="relative pb-20 lg:pb-28 scroll-mt-24 overflow-x-hidden">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3 font-mono-ui text-[11px] text-dimmer">
          <span>↑ OPERATOR · LIVE</span>
          <span>{operatorTime || '\u00a0'}</span>
        </div>

        {/* Console frame */}
        <div className="card-elevated rounded-2xl overflow-hidden">
          {/* Console header */}
          <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-line">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-acid pulse-dot flex-shrink-0" />
              <span className="font-mono-ui text-[11px] text-acid truncate">whatsapp.ai · operator console</span>
            </div>
            <div className="font-mono-ui text-[10.5px] text-dimmer flex-shrink-0">uptime <span className="text-ink">99.97%</span> · lat. <span className="text-ink">142ms</span></div>
          </div>

          {/* Console body — 3 coloane egale */}
          <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-line">
            {/* STATUS col */}
            <div className="p-5">
              <div className="font-mono-ui text-[9.5px] text-dimmer tracking-widest uppercase mb-4">STATUS</div>
              <div className="flex items-center justify-between mb-1">
                <div className="font-display text-[28px] text-ink leading-none">activ.</div>
                <div className="w-10 h-6 rounded-full flex items-center justify-end pr-1" style={{ background: 'var(--acid)' }}>
                  <div className="w-4 h-4 rounded-full" style={{ background: 'var(--on-acid)' }} />
                </div>
              </div>
              <div className="font-mono-ui text-[10.5px] text-acid mb-0.5">· live</div>
              <div className="font-mono-ui text-[10px] text-dimmer mb-6">tu · offline de 23m</div>
              <div className="font-mono-ui text-[9.5px] text-dimmer tracking-widest uppercase mb-3">MESAJE / ORĂ</div>
              <div className="flex items-end gap-1 h-[52px] mb-1">
                {[65, 45, 80, 55, 90, 70, 60, 85].map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm bar-anim" style={{ height: `${h}%`, background: 'var(--acid)', animation: `barGrow 0.5s ease ${i * 0.07}s both` }} />
                ))}
              </div>
              <div className="flex justify-between font-mono-ui text-[9px] text-dimmer mb-6">
                <span>14:00</span><span>21:47</span>
              </div>
              <div className="card-glass rounded-xl p-3">
                <div className="font-mono-ui text-[9px] text-acid mb-1">▣</div>
                <div className="font-mono-ui text-[12px] text-ink font-medium">knowledge base</div>
                <div className="font-mono-ui text-[10px] text-dimmer mt-0.5">12 secțiuni · sincronizate</div>
              </div>
            </div>

            {/* CONVERSAȚIE col */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="font-mono-ui text-[9.5px] text-dimmer tracking-widest uppercase">CONVERSAȚIE · #4719</div>
                <span className="font-mono-ui text-[10px] text-acid border border-acid rounded-full px-2 py-0.5 pulse-dot">· live</span>
              </div>
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-9 h-9 rounded-full font-mono-ui text-[11px] font-bold text-ink flex items-center justify-center flex-shrink-0" style={{ background: 'var(--card-hi)' }}>MD</div>
                <div>
                  <div className="font-mono-ui text-[13px] font-medium text-ink">Maria D.</div>
                  <div className="font-mono-ui text-[10px] text-dimmer">lead nou · imobiliare</div>
                </div>
                <div className="ml-auto font-mono-ui text-[10px] text-dimmer">21:47</div>
              </div>
              {/* Live animated chat */}
              <div className="relative">
                <div className="space-y-3 overflow-hidden" style={{ height: '380px', overflowY: 'hidden' }}>
                  {LIVE_CHAT.slice(0, shown).map((msg, i) => (
                    <div key={i} className={`flex ${msg.side === 'right' ? 'justify-end' : 'justify-start'}${i === shown - 1 ? ' fade-in' : ''}`}>
                      <div
                        className={msg.side === 'right' ? 'bubble-r px-4 py-2.5 text-[13px] text-ink max-w-[85%]' : 'bubble-l px-4 py-2.5 text-[13px] text-dim inline-block max-w-[85%]'}
                        style={msg.side === 'right'
                          ? { background: 'color-mix(in oklab, var(--acid) 18%, var(--card-hi))' }
                          : { background: 'var(--card-bg)', border: '1px solid var(--line)' }}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {typing && (
                    <div className="flex justify-end fade-in">
                      <div className="bubble-r px-3 py-2.5 flex gap-1" style={{ background: 'color-mix(in oklab, var(--acid) 18%, var(--card-hi))' }}>
                        <span className="typing-dot text-acid text-lg">·</span>
                        <span className="typing-dot text-acid text-lg">·</span>
                        <span className="typing-dot text-acid text-lg">·</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none" style={{ background: 'linear-gradient(to top, var(--card-elevated, var(--card-hi)), transparent)' }} />
              </div>
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-line">
                <div className="flex items-center gap-2 font-mono-ui text-[10px] text-dimmer">
                  <span>STIL · 99% match</span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4].map(i => <div key={i} className="w-1.5 h-3.5 rounded-sm" style={{ background: 'var(--acid)' }} />)}
                  </div>
                </div>
                <span className="font-mono-ui text-[10px] text-acid">preia tu →</span>
              </div>
            </div>

            {/* RECENT col */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="font-mono-ui text-[9.5px] text-dimmer tracking-widest uppercase">RECENT</div>
                <span className="font-mono-ui text-[10px] text-dimmer">14h</span>
              </div>
              <div className="space-y-4">
                {[
                  { dot: 'acid', title: 'programare nouă · sâmbătă 14:00', sub: 'Andrei P.', time: '4m ago' },
                  { dot: 'acid', title: 'a confirmat vizionarea', sub: 'Cristian V.', time: '12m ago' },
                  { dot: 'danger', title: 'client frustrat · te-am alertat', sub: 'Elena M.', time: '27m ago' },
                  { dot: 'dim', title: 'audio transcris · 0:42', sub: 'Diana R.', time: '1h ago' },
                  { dot: 'dim', title: 'contact pe blacklist · sărit', sub: '+40 723 ···', time: '2h ago' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: item.dot === 'acid' ? 'var(--acid)' : item.dot === 'danger' ? 'var(--danger)' : 'var(--dim)' }} />
                    <div>
                      <div className="font-mono-ui text-[11px] text-ink leading-snug">{item.title}</div>
                      <div className="font-mono-ui text-[10px] text-dimmer mt-0.5">{item.sub} · {item.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}

// ─── TICKER ───────────────────────────────────────────────────────────────────
const TICKER_ITEMS = [
  '● LIVE · agent @salon_ana a răspuns în 0.4s',
  '● LIVE · programare confirmată automat · @clinic_dent',
  '● LIVE · 3 lead-uri noi capturate · @imobiliare_vest',
  '● LIVE · mesaj vocal transcris și procesat · @coach_radu',
  '● LIVE · agent @shop_moda a salvat o comandă abandonată',
  '● LIVE · client mulțumit · sentiment pozitiv detectat',
  '● LIVE · baza de cunoștințe actualizată · @freelancer_web',
  '● LIVE · agent activ în paralel pe 3 conversații',
]

function Ticker() {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <div className="border-y border-line overflow-hidden py-3">
      <div className="marquee-track flex gap-12 whitespace-nowrap">
        {doubled.map((item, i) => (
          <span key={i} className="font-mono-ui text-[11px] text-dimmer flex-shrink-0">{item}</span>
        ))}
      </div>
    </div>
  )
}

// ─── §01 DIFFERENTIATOR ───────────────────────────────────────────────────────
const HIGHLIGHTS = [
  {
    icon: FileText,
    tag: 'RAG',
    title: 'răspunde din documentele tale',
    desc: 'Încarci PDF, DOCX sau TXT. Agentul caută în ele și răspunde clienților exact din informațiile tale — prețuri, politici, specificații — fără să inventeze.',
    detail: (
      <div className="flex items-center gap-1.5 font-mono-ui text-[10px] text-dimmer">
        <span className="px-1.5 py-0.5 rounded bg-cardhi text-ink">PDF</span>
        <span className="px-1.5 py-0.5 rounded bg-cardhi text-ink">DOCX</span>
        <span className="px-1.5 py-0.5 rounded bg-cardhi text-ink">TXT</span>
        <ArrowRight className="h-3 w-3 text-acid" />
        <span className="text-acid">răspuns exact</span>
      </div>
    ),
  },
  {
    icon: Flame,
    tag: 'LEAD-URI',
    title: 'califică automat contactele',
    desc: 'Fiecare client primește un scor hot / warm / cold după criteriile tale. Vezi instant cine merită un telefon acum și cine poate aștepta.',
    detail: (
      <div className="flex items-center gap-3 font-mono-ui text-[10px]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--danger)' }} />hot</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--acid)' }} />warm</span>
        <span className="flex items-center gap-1 text-dimmer"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--line)' }} />cold</span>
      </div>
    ),
  },
  {
    icon: ShoppingCart,
    tag: 'COMENZI + STOC',
    title: 'preia comenzi și ține stocul',
    desc: 'Agentul colectează comanda în conversație, calculează totalul din prețurile reale și scade stocul atomic la confirmare. Tu vezi totul în dashboard.',
    detail: (
      <div className="flex items-center justify-between font-mono-ui text-[10.5px]">
        <span className="text-dim">2× tunsoare</span>
        <span className="text-ink">90 lei <span className="text-acid">✓</span></span>
      </div>
    ),
  },
]

function Differentiator() {
  return (
    <section id="diff" className="relative py-24 lg:py-32 border-b border-line overflow-hidden">
      <div className="absolute inset-0 gridlines opacity-20 pointer-events-none" />
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 relative">

        {/* Statement — un singur enunț, urmat de 3 dovezi (nu carduri) */}
        <div className="max-w-[920px] mb-14">
          <div className="font-mono-ui text-[11px] text-acid tracking-widest mb-6">§03 — DINCOLO DE RĂSPUNSURI</div>
          <h2 className="font-display text-[32px] sm:text-[52px] lg:text-[72px] text-ink leading-[1.05]">
            nu doar răspunde la mesaje.{' '}
            <span className="text-acid">vinde, califică și răspunde din documentele tale.</span>
          </h2>
          <p className="mt-6 text-[16px] text-dim leading-relaxed max-w-[560px]">
            Trei lucruri pe care un autoresponder nu le face niciodată — și care îl transformă dintr-un bot într-un coleg de business.
          </p>
        </div>

        {/* Cele 3 dovezi — rânduri, nu carduri */}
        <div className="divide-y border-t border-b" style={{ borderColor: 'var(--line)' }}>
          {HIGHLIGHTS.map(({ icon: Icon, tag, title, desc, detail }) => (
            <div key={tag} className="grid grid-cols-[44px_1fr] sm:grid-cols-[44px_260px_1fr_auto] items-center gap-4 sm:gap-8 py-6 group hover:bg-cardhi transition-colors px-2 rounded">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl"
                style={{ background: 'color-mix(in oklab, var(--acid) 16%, var(--card-hi))' }}>
                <Icon className="h-4 w-4 text-acid" />
              </span>
              <div>
                <div className="font-mono-ui text-[10px] text-acid tracking-widest mb-1">{tag}</div>
                <h3 className="font-display text-[20px] sm:text-[22px] text-ink leading-tight">{title}</h3>
              </div>
              <p className="hidden sm:block text-[14px] text-dim leading-relaxed">{desc}</p>
              <div className="hidden sm:flex items-center justify-end">{detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── §02 HOW IT WORKS ─────────────────────────────────────────────────────────
const QR_PATTERNS = [
  [
    [1,1,1,1,1,1,1,0,1,0,0,1,0,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,1,1,0,1,1,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,0,1,0,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,0,0,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,1,0,1,0,1,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0],
    [1,0,1,1,0,1,1,1,0,0,1,0,1,1,1,0,1,0,1,1,0],
    [0,1,0,0,1,0,0,0,1,1,0,1,0,0,0,1,0,1,0,0,1],
    [1,1,1,0,1,1,1,0,0,0,1,0,1,0,1,0,1,1,1,0,1],
    [0,0,0,1,0,0,0,1,1,0,0,1,0,1,0,1,0,0,0,1,0],
    [1,1,1,1,1,1,1,0,1,1,0,0,1,0,1,0,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,0,0,1,0,1,1,1,1,0,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,1,0,1,0,0,0,0,1,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,0,1,0,1,1,1,0,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,0,0,1,1,0,0,0,1,0],
    [1,0,1,1,1,0,1,0,0,1,0,1,1,0,0,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,1,0,1,0,0,1,1,1,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,0,1,0,1,0,0,1,0,1,1,1,1,1],
  ],
  [
    [1,1,1,1,1,1,1,0,0,1,1,0,1,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,0,1,1,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,1,0,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,1,0,1,1,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0],
    [0,1,1,0,1,1,1,0,0,1,0,0,1,0,1,1,0,1,0,1,1],
    [1,0,1,1,0,0,0,1,0,0,1,1,0,0,1,0,1,0,1,1,0],
    [0,0,1,1,0,1,1,1,1,0,0,0,1,1,0,1,0,0,1,1,0],
    [1,1,0,0,1,1,0,0,1,1,0,0,1,0,1,0,1,1,0,0,1],
    [0,0,1,0,1,0,1,1,0,0,1,1,0,1,0,1,0,0,1,0,0],
    [0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,0,1,0,1,0,0,0,1,1,0,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,1,0,1,1,0,0,0,1,0,0,1,0],
    [1,0,1,1,1,0,1,0,1,0,1,0,0,1,1,1,0,0,1,1,0],
    [1,0,1,1,1,0,1,0,0,1,0,1,0,1,0,0,1,1,0,0,1],
    [1,0,1,1,1,0,1,0,1,0,0,0,1,1,1,0,0,0,1,1,0],
    [1,0,0,0,0,0,1,0,0,1,1,0,0,0,0,1,1,0,1,0,1],
    [1,1,1,1,1,1,1,0,1,0,0,1,1,0,0,1,0,0,1,0,0],
  ],
  [
    [1,1,1,1,1,1,1,0,1,1,0,0,1,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,1,0,1,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,0,0,1,1,0,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,0,1,1,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,0,1,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,1,0,0,1,1,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
    [1,1,0,1,0,0,1,0,1,0,0,1,0,1,0,0,1,1,0,0,1],
    [0,0,1,0,1,1,0,1,1,0,1,0,1,1,0,1,0,1,1,0,0],
    [1,0,0,1,1,0,1,0,0,1,1,0,0,1,1,0,1,0,0,1,1],
    [0,1,1,0,0,1,0,1,0,0,1,1,0,0,0,1,0,1,1,0,1],
    [1,0,1,1,0,0,1,0,1,1,0,0,1,0,1,0,1,0,0,1,0],
    [0,0,0,0,0,0,0,0,1,0,0,1,0,1,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,0,0,0,1,0,1,0,0,1,1,0,1,1,0],
    [1,0,0,0,0,0,1,0,1,1,0,1,0,1,1,0,0,1,0,0,1],
    [1,0,1,1,1,0,1,0,0,0,1,0,1,0,0,1,0,1,1,0,0],
    [1,0,1,1,1,0,1,0,1,0,0,1,0,1,0,0,1,0,0,1,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,0,0,1,1,0,1,0,0,1],
    [1,0,0,0,0,0,1,0,1,0,0,1,1,0,0,0,1,1,1,0,0],
    [1,1,1,1,1,1,1,0,0,1,1,0,0,1,1,0,0,1,0,1,1],
  ],
]

const BUSINESSES = [
  {
    lines: [
      { label: '# program', value: 'L-V 9-18, S 10-14' },
      { label: '# tunsoare clasică', value: '80 RON · 30min' },
      { label: '# vopsit', value: 'de la 220 RON' },
    ],
    footer: '+ stil învățat din 1.247 mesaje',
  },
  {
    lines: [
      { label: '# consultație', value: '150 RON · 30min' },
      { label: '# program cabinet', value: 'L-V 8-20, S 9-14' },
      { label: '# urgențe', value: 'redirecționare 24/7' },
    ],
    footer: '+ stil învățat din 892 mesaje',
  },
  {
    lines: [
      { label: '# apmt. 2 cam.', value: 'de la 89.000 EUR' },
      { label: '# chirii active', value: '34 oferte disponibile' },
      { label: '# vizionări', value: 'L-D cu programare' },
    ],
    footer: '+ stil învățat din 3.421 mesaje',
  },
  {
    lines: [
      { label: '# pizza margherita', value: '32 RON · 500g' },
      { label: '# livrare', value: '11-23, inclusiv S-D' },
      { label: '# timp mediu', value: '35-45 min' },
    ],
    footer: '+ stil învățat din 2.108 mesaje',
  },
]

function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [toggleOn, setToggleOn] = useState(true)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.15 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const id = setInterval(() => setToggleOn(v => !v), 1800)
    return () => clearInterval(id)
  }, [])

  return (
    <section id="how" className="relative py-24 lg:py-32 border-b border-line">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8">

        {/* Header row */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 mb-16">
          <div>
            <div className="font-mono-ui text-[11px] text-acid tracking-widest mb-6">§01 — CUM.MERGE</div>
            <h2 className="font-display text-[34px] sm:text-[52px] lg:text-[76px] text-ink">
              de la zero la primul<br />
              răspuns automat<br />
              <span className="text-acid">— 4 minute.</span>
            </h2>
          </div>
          <div className="flex items-end pb-2">
            <p className="text-[16px] text-dim leading-relaxed">
              Nu instalezi nimic pe telefon. Nu schimbi numărul. Nu pierzi conversațiile vechi.
            </p>
          </div>
        </div>

        {/* 3 cards */}
        <div ref={sectionRef} className="grid md:grid-cols-3 gap-4">
          {/* Card 01 — QR */}
          <div className="card-elevated rounded-2xl p-7 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(36px)', transitionDelay: '0ms' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="font-mono-ui text-[9.5px] text-dimmer tracking-widest uppercase">PASUL.01</div>
              <div className="font-mono-ui text-[28px] text-acid font-display leading-none">01</div>
            </div>
            <h3 className="font-display text-[22px] text-ink mb-3">
              scanezi un QR<br />și ești conectat.
            </h3>
            <p className="text-[13px] text-dim leading-relaxed mb-6">
              Cont WhatsApp legat în 30 de secunde. Nu schimbi nimic în aplicația ta — funcționează în paralel.
            </p>
            {/* QR code visual */}
            <div className="rounded-xl overflow-hidden p-4" style={{ background: 'var(--card-hi)' }}>
              <svg
                viewBox="0 0 120 120"
                className="w-full max-w-[140px] mx-auto block"
                style={{ imageRendering: 'pixelated' }}
              >
                {(() => {
                  const pattern = QR_PATTERNS[0]
                  const cells: React.ReactElement[] = []
                  const size = 120 / 21
                  pattern.forEach((row, r) =>
                    row.forEach((cell, c) => {
                      if (cell) cells.push(
                        <rect key={`${r}-${c}`} x={c * size} y={r * size} width={size} height={size} fill="var(--ink)" />
                      )
                    })
                  )
                  return cells
                })()}
              </svg>
            </div>
          </div>

          {/* Card 02 — Knowledge base */}
          <div className="card-elevated rounded-2xl p-7 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(36px)', transitionDelay: '150ms' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="font-mono-ui text-[9.5px] text-dimmer tracking-widest uppercase">PASUL.02</div>
              <div className="font-mono-ui text-[28px] text-acid font-display leading-none">02</div>
            </div>
            <h3 className="font-display text-[22px] text-ink mb-3">
              îi spui ce știi<br />despre business.
            </h3>
            <p className="text-[13px] text-dim leading-relaxed mb-6">
              Prețuri, program, servicii, întrebări frecvente. Urci arhiva WhatsApp și învață cum scrii.
            </p>
            {/* Code block */}
            <div
              className="rounded-xl p-4 font-mono-ui text-[12px] leading-relaxed"
              style={{ background: 'var(--card-hi)' }}
            >
              {BUSINESSES[0].lines.map(({ label, value }) => (
                <div key={label} className="mt-2 first:mt-0">
                  <div className="text-dimmer">{label}</div>
                  <div className="text-ink">{value}</div>
                </div>
              ))}
              <div className="mt-3 pt-3 border-t border-line text-acid">{BUSINESSES[0].footer}</div>
            </div>
          </div>

          {/* Card 03 — Activate */}
          <div className="card-elevated rounded-2xl p-7 transition-all duration-700" style={{ background: 'color-mix(in oklab, var(--acid) 8%, var(--card-hi))', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(36px)', transitionDelay: '300ms' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="font-mono-ui text-[9.5px] text-dimmer tracking-widest uppercase">PASUL.03</div>
              <div className="font-mono-ui text-[28px] text-acid font-display leading-none">03</div>
            </div>
            <h3 className="font-display text-[22px] text-ink mb-3">
              activezi agentul<br />și te ocupi de altele.
            </h3>
            <p className="text-[13px] text-dim leading-relaxed mb-6">
              Răspunde noaptea, în ședințe, în concediu. Tu vezi tot în dashboard.
            </p>
            {/* Toggle + chart */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(10,15,12,0.06)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-mono-ui text-[12px] text-ink font-medium transition-opacity duration-300" style={{ opacity: toggleOn ? 1 : 0.45 }}>
                    {toggleOn ? 'agent activ' : 'agent inactiv'}
                  </div>
                  <div className="font-mono-ui text-[10px] text-dimmer">23 conv. azi</div>
                </div>
                <div
                  className="w-11 h-6 rounded-full flex items-center px-0.5 transition-all duration-500 cursor-pointer"
                  style={{ background: toggleOn ? 'var(--acid)' : 'var(--line)', justifyContent: toggleOn ? 'flex-end' : 'flex-start' }}
                >
                  <div className="w-5 h-5 rounded-full transition-all duration-500" style={{ background: toggleOn ? 'var(--on-acid)' : 'var(--dimmer)' }} />
                </div>
              </div>
              <div className="flex items-end gap-1 h-8">
                {[55, 70, 40, 85, 65, 90, 75].map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm transition-all duration-500" style={{ height: `${h}%`, background: toggleOn ? 'var(--acid)' : 'var(--dimmer)', opacity: toggleOn ? 1 : 0.4 }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── §03 FEATURES — TABLE ROWS ────────────────────────────────────────────────
const FEATURES = [
  {
    no: '01', title: 'răspunde 24/7, fără excepții',
    desc: 'Timer 1–60 min. Dacă nu răspunzi în acel interval, agentul preia automat conversația.',
    visual: <div className="flex items-end gap-0.5 h-5">{[40,70,50,90,65,85,55,100,75].map((h,i)=><div key={i} className="w-1 rounded-sm" style={{height:`${h}%`,background:'var(--acid)'}}/>)}</div>,
  },
  {
    no: '02', title: 'bază de cunoștințe a ta',
    desc: 'Prețuri, program, servicii, politici, FAQ. Răspunde cu informații reale — nu inventate.',
    visual: <div className="font-mono-ui text-[10px] text-dim flex flex-col gap-0.5"><span className="text-acid">conținut.md</span><span>faq.md</span><span className="text-dimmer">+8</span></div>,
  },
  {
    no: '03', title: 'memorie per client',
    desc: 'Își amintește că Maria caută 2 camere. Andrei a întrebat de tuns săptămâna trecută.',
    visual: <div className="flex items-center gap-1"><div className="flex" style={{gap:'-4px'}}>{['MD','AP','RV'].map((t,idx)=><div key={idx} className="w-6 h-6 rounded-full font-mono-ui text-[8px] font-bold text-ink flex items-center justify-center border border-line -ml-1 first:ml-0" style={{background:'var(--card-hi)'}}>{t}</div>)}</div><span className="font-mono-ui text-[9px] text-dimmer ml-1">+42</span></div>,
  },
  {
    no: '04', title: 'înțelege mesajele vocale',
    desc: 'Transcrie audio-ul și răspunde la conținut, nu doar la „salut". Română nativ.',
    visual: <div className="font-mono-ui text-[10px] text-dim">▶ 0:43 <span className="text-acid">·</span> 21</div>,
  },
  {
    no: '05', title: 'detectează frustrarea și urgența',
    desc: 'Client nervos sau cerere urgentă — primești alertă pe WhatsApp și AI ajustează tonul răspunsului.',
    visual: <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:'var(--danger)'}} /><span className="font-mono-ui text-[10px]" style={{color:'var(--danger)'}}>tone</span><span className="font-mono-ui text-[11px] font-bold text-acid">!</span></div>,
  },
  {
    no: '06', title: 'listă neagră de contacte',
    desc: 'Familie, prieteni, parteneri. Excluzi orice număr — primesc doar mesajele tale reale.',
    visual: <div className="font-mono-ui text-[10.5px] text-dim">+40 723···<br/><span className="text-acid">skip ✓</span></div>,
  },
  {
    no: '07', title: 'notificări în timp real',
    desc: 'Când AI preia o conversație primești mesaj pe WhatsApp. Ești mereu în control.',
    visual: <div className="flex items-center gap-1.5"><span className="font-mono-ui text-[18px] leading-none">🤖</span><span className="font-mono-ui text-[9px] text-dim">AI a preluat<br/><span className="text-acid">+40 758···</span></span></div>,
  },
  {
    no: '08', title: 'statistici și dashboard',
    desc: 'Câte mesaje a răspuns AI azi, în 7 și 30 de zile. Conversații preluate, sesiune activă.',
    visual: <div className="flex items-end gap-0.5 h-5">{[60,90,45,75,100].map((h,i)=><div key={i} className="w-1.5 rounded-sm" style={{height:`${h}%`,background:'var(--acid)'}}/>)}<span className="font-mono-ui text-[9px] text-acid ml-1">+34k</span></div>,
  },
  {
    no: '09', title: 'pornești/oprești instant',
    desc: 'Un singur switch din dashboard. Sau direct din WhatsApp cu /activateAI și /deactivateAI.',
    visual: <div className="w-11 h-6 rounded-full flex items-center justify-end pr-0.5" style={{background:'var(--acid)'}}><div className="w-5 h-5 rounded-full" style={{background:'var(--on-acid)'}}/></div>,
  },
]

function Features() {
  return (
    <section id="features" className="relative py-24 lg:py-32 border-b border-line">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 mb-14">
          <div>
            <div className="font-mono-ui text-[11px] text-acid tracking-widest mb-6">§02 — FUNCȚIONALITĂȚI</div>
            <h2 className="font-display text-[32px] sm:text-[48px] lg:text-[60px] text-ink">
              tot ce face agentul<br />
              când <span className="text-dim">nu poți</span><br />
              răspunde.
            </h2>
          </div>
          <div className="flex items-end pb-2">
            <p className="text-[16px] text-dim leading-relaxed">
              Nouă lucruri pe care le face singur. Toate setabile, toate oprite-pornite cu un click.
            </p>
          </div>
        </div>

        {/* Table rows */}
        <div className="divide-y border-t border-b border-line" style={{ borderColor: 'var(--line)' }}>
          {FEATURES.map((f) => (
            <div key={f.no} className="grid grid-cols-[40px_1fr_auto] sm:grid-cols-[40px_220px_1fr_140px] items-center gap-4 sm:gap-8 py-5 group hover:bg-cardhi transition-colors px-2 rounded">
              <div className="font-mono-ui text-[11px] text-dimmer">{f.no}</div>
              <div className="font-display text-[17px] sm:text-[18px] text-ink">{f.title}</div>
              <div className="hidden sm:block text-[13px] text-dim leading-relaxed">{f.desc}</div>
              <div className="flex items-center justify-end">{f.visual}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── §04 PRICING ──────────────────────────────────────────────────────────────
const PLAN_LUNAR = [
  'agent AI activ 24/7',
  'mesaje nelimitate',
  'stilul tău clonat din conversații',
  'transcriere vocale & detecție sentiment',
]

const PLAN_ANUAL_EXTRA = [
  'tot ce e în Lunar, plus:',
  'suport prioritar < 2h',
  'acces beta features',
  'economisești 201 RON / an',
]

function Pricing() {
  return (
    <section id="pricing" className="relative py-24 lg:py-32 border-b border-line">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8">

        {/* Headline */}
        <div className="mb-14">
          <div className="font-mono-ui text-[11px] text-acid tracking-widest mb-6">§04 — PREȚURI</div>
          <div className="grid lg:grid-cols-2 gap-8 items-end">
            <h2 className="font-display text-[34px] sm:text-[52px] lg:text-[80px] text-ink">
              plătești cât<br />
              <span className="text-acid">câștigi.</span><br />
              anulezi când<br />
              vrei.
            </h2>
            <div className="pb-2">
              <p className="font-mono-ui text-[11.5px] text-dimmer mb-2">7 zile trial gratuit · card necesar</p>
              <p className="text-[14px] text-dim leading-relaxed max-w-[320px]">
                Nu îți retragem niciun ban în primele 7 zile. Te setezi oriunde, anulezi oricând fără cost.
              </p>
            </div>
          </div>
        </div>

        {/* Cards — 2 coloane */}
        <div className="grid md:grid-cols-2 gap-4">
            {/* Lunar */}
            <div className="card-elevated rounded-2xl p-5 flex flex-col transition-shadow hover:shadow-lg hover:border-acid/30 border border-line cursor-default">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-display text-[18px] text-ink">lunar</div>
                  <div className="font-mono-ui text-[9px] text-dimmer tracking-widest uppercase mt-0.5">FLEXIBIL</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-[36px] text-ink leading-none">
                    49<span className="text-[22px]">.99</span>
                  </div>
                  <div className="font-mono-ui text-[10px] text-dimmer">RON / lună</div>
                </div>
              </div>
              <p className="text-[12px] text-dim mb-4">Facturat lunar. Anulezi oricând cu un click.</p>
              <ul className="space-y-2 mb-5 flex-1">
                {PLAN_LUNAR.map(f => (
                  <li key={f} className="flex items-center gap-2 font-mono-ui text-[12px] text-dim">
                    <Check className="w-3 h-3 text-acid flex-shrink-0" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block text-center border border-line text-ink font-mono-ui font-medium text-[12px] py-2.5 rounded-full hover:bg-cardhi transition-colors">
                Începe trialul de 7 zile
              </Link>
            </div>

            {/* Anual */}
            <div className="rounded-2xl p-5 flex flex-col relative transition-shadow hover:shadow-xl cursor-default" style={{ background: 'var(--acid)' }}>
              <div className="absolute -top-3 right-5 font-mono-ui text-[9px] font-bold px-2.5 py-0.5 rounded-full"
                style={{ background: 'var(--ink)', color: 'var(--on-acid)' }}>★ ECONOMISEȘTI 33%</div>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-display text-[18px] leading-none" style={{ color: 'var(--on-acid)' }}>anual</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-[36px] leading-none" style={{ color: 'var(--on-acid)' }}>
                    399<span className="text-[22px]">.99</span>
                  </div>
                  <div className="font-mono-ui text-[10px]" style={{ color: 'var(--on-acid-muted)' }}>RON / an</div>
                </div>
              </div>
              <p className="font-mono-ui text-[11px] mb-0.5" style={{ color: 'var(--on-acid)' }}>
                Echivalent ~33.25 RON / lună
              </p>
              <p className="font-mono-ui text-[10.5px] mb-4" style={{ color: 'var(--on-acid-muted)' }}>
                economisești 201 RON față de lunar
              </p>
              <ul className="space-y-2 mb-5 flex-1">
                {PLAN_ANUAL_EXTRA.map((f, i) => (
                  <li key={f} className={`flex items-center gap-2 font-mono-ui text-[12px] ${i === 0 ? 'font-semibold' : ''}`} style={{ color: 'var(--on-acid)' }}>
                    <Check className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--on-acid)' }} strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block text-center font-mono-ui font-medium text-[12px] py-2.5 rounded-full transition-opacity hover:opacity-90"
                style={{ background: '#ffffff', color: '#0A0F0C' }}>
                Începe trialul de 7 zile
              </Link>
            </div>

        </div>

        {/* Footer trust */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono-ui text-[10.5px] text-dimmer pt-4">
          <span>✓ anulezi cu un click</span>
          <span>✓ fără contracte</span>
          <span>✓ date stocate în UE</span>
          <span>✓ factură pe firmă (plan anual)</span>
        </div>
      </div>
    </section>
  )
}

// ─── §05 FAQ ──────────────────────────────────────────────────────────────────
const FAQ_ITEMS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Este legal să folosesc asta cu WhatsApp?',
    a: 'Da. E contul tău personal, tu decizi ce răspunde. Nu trimitem mesaje în masă, nu spamăm, nu colectăm contactele fără consimțământ. Tu deții conversațiile, tu deții agentul.',
  },
  {
    q: 'clienții vor ști că vorbesc cu un bot?',
    a: 'Dacă ți-ai configurat corect stilul — nu. Agentul analizează cum scrii tu și reproduce fidel. În teste, sub 3% din conversații sunt detectate ca automate.',
  },
  {
    q: 'ce se întâmplă când sunt online și răspund eu?',
    a: 'Agentul se retrage automat imediat ce ești activ. Nu vei trimite niciodată două răspunsuri la același mesaj.',
  },
  {
    q: 'pot opri agentul oricând?',
    a: 'Un switch în dashboard. Sau direct din WhatsApp îi trimiți /deactivateAI. Nu există situație în care nu poți opri instant.',
  },
  {
    q: 'ce limbi înțelege?',
    a: 'Română. Engleză, Maghiară, Germană, Italiană, Franceză, Spaniolă cu fluență. Cu diacritice sau fără, română amestecată cu engleză — reproduce exact felul tău.',
  },
  {
    q: 'datele mele sunt în siguranță?',
    a: 'Stocate în UE (Frankfurt), criptate la rest și în tranzit. Nu folosim datele tale pentru antrenarea modelelor generale. Poți cere ștergere totală oricând.',
  },
  {
    q: 'ce modele AI sunt folosite?',
    a: (
      <div className="flex flex-col gap-3">
        {[
          { model: 'Llama 3.3 70B', by: 'Meta', role: 'conversații', note: 'model open-source, rulat pe Groq LPU pentru răspunsuri rapide' },
          { model: 'Whisper Large V3', by: 'OpenAI', role: 'mesaje vocale', note: 'transcriere automată a audio-urilor și PTT-urilor' },
          { model: 'Gemini 2.0 Flash', by: 'Google', role: 'backup', note: 'disponibil ca alternativă în caz de indisponibilitate' },
        ].map(m => (
          <div key={m.model} className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-acid" />
            <div>
              <span className="text-ink font-medium">{m.model}</span>
              <span className="text-dimmer"> · {m.by} · {m.role}</span>
              <div className="text-dimmer text-[12px] mt-0.5">{m.note}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
]

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="relative py-24 lg:py-32 border-b border-line">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">

          {/* Left */}
          <div>
            <div className="font-mono-ui text-[11px] text-acid tracking-widest mb-6">§05 — FAQ</div>
            <h2 className="font-display text-[32px] sm:text-[48px] lg:text-[68px] text-ink">
              ce ne<br />
              <span className="text-acid">întreabă</span><br />
              toți, înainte<br />
              să încerce.
            </h2>
            <p className="mt-8 text-[14px] text-dim leading-relaxed">
              Nu găsești răspunsul? Scrie-ne la{' '}
              <a href="mailto:support@waai.ro" className="text-acid hover:opacity-75 transition-opacity">
                support@waai.ro
              </a>
              . Răspundem în câteva ore.<br />
              Noi, nu agentul.
            </p>
          </div>

          {/* Right — accordion */}
          <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openIndex === i
              return (
                <div key={i} className="py-5">
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="flex items-start justify-between gap-4 w-full text-left"
                  >
                    <span className="font-display-md text-[17px] text-ink flex-1">{item.q}</span>
                    <span className={`flex-shrink-0 w-7 h-7 rounded-full border border-line text-dim grid place-items-center font-mono-ui text-[14px] transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}>
                      +
                    </span>
                  </button>
                  <div
                    className="overflow-hidden transition-all duration-300 ease-in-out"
                    style={{ maxHeight: isOpen ? '320px' : '0px', opacity: isOpen ? 1 : 0 }}
                  >
                    <div className="text-[13.5px] text-dim leading-relaxed mt-3 pr-10">{item.a}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer id="footer" className="border-t border-line pt-12 pb-6">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-12 gap-10 mb-8">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-5">
            <a href="#top" className="inline-flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full" style={{ background: '#25D366' }}>
                <WaIcon size={22} />
              </span>
              <span className="font-mono-ui text-[24px] font-semibold text-ink">
                wa<span className="text-acid">ai.</span>
              </span>
            </a>
            <p className="mt-6 text-[14px] text-dim max-w-[380px] leading-relaxed">
              AI-ul care preia automat conversațiile și păstrează experiența personală a brandului tău.
            </p>
          </div>

          {/* Legal */}
          <div className="lg:col-span-3">
            <div className="font-mono-ui text-[10.5px] text-dimmer tracking-widest uppercase mb-4">LEGAL</div>
            <div className="flex flex-col gap-3 font-mono-ui text-[14px]">
              <Link href="/termeni" scroll={false} className="text-dim hover:text-ink transition-colors w-fit pb-0.5 border-b border-transparent hover:border-acid">termeni și condiții</Link>
              <Link href="/confidentialitate" scroll={false} className="text-dim hover:text-ink transition-colors w-fit pb-0.5 border-b border-transparent hover:border-acid">confidențialitate</Link>
              <Link href="/gdpr" scroll={false} className="text-dim hover:text-ink transition-colors w-fit pb-0.5 border-b border-transparent hover:border-acid">gdpr</Link>
              <Link href="/cookies" scroll={false} className="text-dim hover:text-ink transition-colors w-fit pb-0.5 border-b border-transparent hover:border-acid">cookies</Link>
            </div>
          </div>

          {/* Contact */}
          <div className="lg:col-span-4">
            <div className="font-mono-ui text-[10.5px] text-dimmer tracking-widest uppercase mb-4">CONTACT</div>
            <div className="flex flex-col gap-3 font-mono-ui text-[14px]">
              <a href="mailto:support@waai.ro" className="text-dim hover:text-ink transition-colors w-fit pb-0.5 border-b border-transparent hover:border-acid">support@waai.ro</a>
              <a href="https://waai.ro" className="text-dim hover:text-ink transition-colors w-fit pb-0.5 border-b border-transparent hover:border-acid">waai.ro</a>
              <a href="tel:+40758154490" className="text-dim hover:text-ink transition-colors w-fit pb-0.5 border-b border-transparent hover:border-acid">0758 154 490</a>
            </div>
          </div>
        </div>

        <div className="border-t border-line pt-5 font-mono-ui text-[11px] text-dimmer">
          <div>
            © 2026{' '}
            <a href="https://acl-smartsoftware.ro" target="_blank" rel="noopener noreferrer" className="hover:text-ink transition-colors">
              ACL Smart Software
            </a>
            {' '}— toate drepturile rezervate
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── SCROLL TO TOP ────────────────────────────────────────────────────────────
function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const howSection = document.getElementById('how')
    if (!howSection) return

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting || window.scrollY > howSection.offsetTop),
      { rootMargin: '0px 0px -80% 0px' }
    )
    observer.observe(howSection)

    const onScroll = () => {
      if (howSection) setVisible(window.scrollY >= howSection.offsetTop - 100)
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Înapoi sus"
      style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
      className={`fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  useEffect(() => {
    if (sessionStorage.getItem('scrollToFooter') === '1') {
      sessionStorage.removeItem('scrollToFooter')
      document.documentElement.style.scrollBehavior = 'auto'
      document.getElementById('footer')?.scrollIntoView()
      document.documentElement.style.scrollBehavior = ''
    }
  }, [])

  return (
    <div className="bg-base min-h-screen">
      <Navbar />
      <ScrollToTop />
      <main id="top" className="overflow-hidden">
        <Hero />
        <OperatorConsole />
        <Ticker />
        <HowItWorks />
        <Features />
        <Differentiator />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  )
}
