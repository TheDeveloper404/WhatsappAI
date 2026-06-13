'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Loader2, LayoutDashboard, MessageSquare, Settings, User, LogOut, ShoppingCart, Menu, X } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { NotificationBell } from '@/components/NotificationBell'

// Entitlement-ul de UI vine acum din API (`/billing/subscription` → `entitled`), sursă unică
// owner-aware (include bypass OWNER_EMAIL). Defense-in-depth: granița reală rămâne API-ul (C1/C2),
// fail-closed pe orice eroare (vezi catch-ul gate-ului mai jos).
function WaIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="#fff">
      <path d="M16 5.5C10.2 5.5 5.5 10.2 5.5 16c0 1.85.49 3.66 1.42 5.25L5.5 26.5l5.4-1.4A10.4 10.4 0 0 0 16 26.5c5.8 0 10.5-4.7 10.5-10.5S21.8 5.5 16 5.5zm0 19.1a8.6 8.6 0 0 1-4.4-1.2l-.31-.18-3.2.83.86-3.12-.2-.32A8.55 8.55 0 0 1 7.4 16a8.6 8.6 0 1 1 8.6 8.6zm4.7-6.43c-.26-.13-1.52-.75-1.76-.84-.24-.09-.41-.13-.58.13s-.66.84-.81 1.01c-.15.17-.3.19-.55.06-.26-.13-1.08-.4-2.06-1.27a7.72 7.72 0 0 1-1.43-1.77c-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.58-1.39-.79-1.9-.21-.5-.42-.43-.58-.44h-.49a.94.94 0 0 0-.68.32c-.23.26-.89.86-.89 2.1s.91 2.44 1.04 2.6c.13.17 1.79 2.73 4.34 3.82.61.26 1.08.42 1.45.54.61.19 1.16.16 1.6.1.49-.07 1.52-.62 1.73-1.22.21-.6.21-1.11.15-1.22-.06-.11-.24-.17-.5-.3z" />
    </svg>
  )
}

// Navigare grupată pe secțiuni + descriere scurtă (ca userul să știe la ce e fiecare).
// Sursă unică pentru sidebar (desktop) și drawer (mobil).
// `match` = când e activă o intrare care acoperă mai multe rute (ex. Vânzări = catalog/comenzi/programări).
type NavItem = { href: string; label: string; desc: string; icon: typeof LayoutDashboard; match?: (p: string) => boolean }
const SALES_PATHS = ['/products', '/orders', '/appointments']
const INBOX_PATHS = ['/conversations', '/leads']
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Principal',
    items: [
      { href: '/dashboard', label: 'Dashboard', desc: 'Privire de ansamblu și metrici', icon: LayoutDashboard },
      { href: '/conversations', label: 'Conversații', desc: 'Mesaje și lead-uri', icon: MessageSquare, match: p => INBOX_PATHS.includes(p) },
      { href: '/products', label: 'Vânzări', desc: 'Catalog, comenzi și programări', icon: ShoppingCart, match: p => SALES_PATHS.includes(p) },
    ],
  },
  {
    title: 'Cont',
    items: [
      { href: '/settings', label: 'Setări', desc: 'Configurarea agentului AI', icon: Settings },
      { href: '/profile', label: 'Profil', desc: 'Cont, parolă și abonament', icon: User },
    ],
  },
]

// Un rând de navigare (folosit în sidebar și drawer).
function NavRow({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors ${
        active ? 'bg-cardhi text-ink' : 'text-dim hover:text-ink hover:bg-cardhi'
      }`}
    >
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${active ? 'text-acid' : ''}`} />
      <span className="min-w-0">
        <span className="block font-mono-ui text-[14px] leading-tight">{item.label}</span>
        <span className="block font-mono-ui text-[10.5px] text-dimmer leading-tight mt-0.5 truncate">{item.desc}</span>
      </span>
    </Link>
  )
}

// Conținutul navigării (grupuri + descrieri), refolosit de sidebar și drawer.
function NavGroups({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
      {NAV_GROUPS.map(group => (
        <div key={group.title}>
          <p className="px-3 mb-1 font-mono-ui text-[9px] font-semibold tracking-widest uppercase text-dimmer">
            {group.title}
          </p>
          <div className="space-y-0.5">
            {group.items.map(item => (
              <NavRow
                key={item.href}
                item={item}
                active={item.match ? item.match(pathname) : pathname === item.href}
                onClick={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

function BrandLink({ size = 'sm', onClick }: { size?: 'sm' | 'lg'; onClick?: () => void }) {
  const circle = size === 'lg' ? 'w-8 h-8' : 'w-7 h-7'
  const text = size === 'lg' ? 'text-[18px]' : 'text-[16px]'
  return (
    <Link href="/dashboard" onClick={onClick} className="flex items-center gap-2.5">
      <span className={`inline-flex items-center justify-center ${circle} rounded-full shrink-0`} style={{ background: '#25D366' }}>
        <WaIcon size={size === 'lg' ? 18 : 16} />
      </span>
      <span className={`font-mono-ui ${text} font-semibold text-ink`}>
        wa<span className="text-acid">ai.</span>
      </span>
    </Link>
  )
}

// Sidebar FIX pe desktop (nu mai dispare la schimbarea paginii). Ascuns pe mobil.
// Doar brand + navigare; theme/deconectare rămân în top bar (ca înainte).
function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="hidden lg:flex fixed left-0 top-0 z-30 h-full w-[260px] bg-base border-r border-line flex-col">
      <div className="px-5 py-4 border-b border-line">
        <BrandLink size="lg" />
      </div>
      <NavGroups pathname={pathname} />
    </aside>
  )
}

// Drawer de navigare — DOAR pe mobil (deschis prin hamburger din top bar).
function NavDrawer({
  open, onClose, pathname, userEmail,
}: {
  open: boolean
  onClose: () => void
  pathname: string
  userEmail?: string
}) {
  // Închidere cu ESC + blocare scroll body cât e deschis
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <div className="lg:hidden">
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-[280px] max-w-[85vw] bg-base border-r border-line flex flex-col transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Meniu navigare"
      >
        {/* Header drawer */}
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <BrandLink size="lg" onClick={onClose} />
          <button
            onClick={onClose}
            className="p-2 text-dimmer hover:text-ink hover:bg-cardhi rounded-lg transition-colors"
            aria-label="Închide meniul"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <NavGroups pathname={pathname} onNavigate={onClose} />

        {/* Bottom — doar email (toggle + deconectare sunt în top bar pe mobil) */}
        {userEmail && (
          <div className="p-3 border-t border-line">
            <p className="font-mono-ui text-[11px] text-dimmer px-3 py-1 truncate">{userEmail}</p>
          </div>
        )}
      </aside>
    </div>
  )
}

// Top bar — theme + deconectare în dreapta (ca înainte). Pe mobil are și hamburger + brand;
// pe desktop brand-ul e în sidebar, deci stânga rămâne goală.
function TopBar({ onMenu, onLogout }: { onMenu: () => void; onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-base/90 backdrop-blur-xs">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 lg:hidden">
          <button
            onClick={onMenu}
            className="p-2 -ml-1 text-dim hover:text-ink hover:bg-cardhi rounded-lg transition-colors"
            aria-label="Deschide meniul"
          >
            <Menu className="h-5 w-5" />
          </button>
          <BrandLink size="sm" />
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <NotificationBell />
          <ThemeToggle />
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 font-mono-ui text-xs text-dim hover:text-red-500 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">deconectare</span>
          </button>
        </div>
      </div>
    </header>
  )
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user, isAuthenticated, accessToken, _hasHydrated, setAuth, clearAuth } = useAuthStore()
  const [checking, setChecking] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const subVerified = useRef(false)

  // Închide meniul (drawer mobil) la schimbarea paginii. Pattern oficial React „ajustează state la
  // schimbare de prop în timpul randării" (nu efect) → fără setState sincron în efect.
  const [prevPath, setPrevPath] = useState(pathname)
  if (pathname !== prevPath) {
    setPrevPath(pathname)
    setMenuOpen(false)
  }

  // Auth-gate: verifică hidratare + sesiune + entitlement și redirecționează. `setChecking()` marchează
  // „verificare terminată" și e parte din lifecycle-ul de auth (depinde de refresh async + redirect-uri,
  // nu e derivabil în render) → dezactivăm `set-state-in-effect` pe TOT efectul (block scoped, re-activat jos).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!_hasHydrated) return

    if (user && !accessToken) {
      api.auth.refresh()
        .then(({ accessToken: newToken }) => setAuth(user, newToken))
        .catch(() => { clearAuth(); router.replace('/login') })
      return
    }

    if (!isAuthenticated) {
      router.replace('/login')
      return
    }

    const isSubscribePage = pathname === '/subscribe'
    const checkoutSuccess = searchParams.get('checkout') === 'success'

    if (isSubscribePage || checkoutSuccess) {
      subVerified.current = false
      setChecking(false)
      return
    }

    if (user?.role === 'admin') {
      subVerified.current = true
      setChecking(false)
      return
    }

    if (subVerified.current) {
      setChecking(false)
      return
    }

    setChecking(true)
    api.billing.getSubscription(accessToken!).then(({ entitled }) => {
      // Gate pe `entitled` = sursa de adevăr OWNER-AWARE din backend (include bypass OWNER_EMAIL +
      // active/trialing valide, exclude past_due/canceled). NU mai calculăm din statusul brut pe client —
      // altfel owner-ul (fără rând de abonament) era trimis greșit pe /subscribe deși API-ul îl lasă.
      if (!entitled) {
        subVerified.current = false
        router.replace('/subscribe')
      } else {
        subVerified.current = true
        setChecking(false)
      }
    }).catch(() => {
      // Fail-CLOSED: dacă verificarea eșuează, NU acordăm acces (înainte era fail-open → bypass
      // de paywall pe orice eroare). Trimitem la /subscribe; pagina aceea iese devreme din acest
      // effect (vezi `isSubscribePage`), deci nu se buclează.
      subVerified.current = false
      router.replace('/subscribe')
    })
  }, [isAuthenticated, accessToken, user, pathname, searchParams, router, _hasHydrated, setAuth, clearAuth])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleLogout() {
    try { await api.auth.logout() } catch {}
    clearAuth()
    router.push('/login')
  }

  // Full spinner while not yet hydrated OR while not yet authenticated.
  if (!_hasHydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <Loader2 className="h-5 w-5 animate-spin text-acid" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base">
      {/* Mobil: drawer */}
      <NavDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        pathname={pathname}
        userEmail={user?.email}
      />

      {/* Desktop: sidebar fix (doar brand + navigare) */}
      <Sidebar pathname={pathname} />

      {/* Conținut — decalat la dreapta de sidebar pe desktop */}
      <div className="lg:pl-[260px]">
        <TopBar onMenu={() => setMenuOpen(true)} onLogout={handleLogout} />
        <main className="p-4 sm:p-6">
          {/* Lățime unică pentru toate paginile din dashboard — sursă unică de adevăr */}
          <div className="max-w-6xl mx-auto w-full">
            {checking ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 animate-spin text-acid" />
              </div>
            ) : children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-base">
        <Loader2 className="h-5 w-5 animate-spin text-acid" />
      </div>
    }>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  )
}
