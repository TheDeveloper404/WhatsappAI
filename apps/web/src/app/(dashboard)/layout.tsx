'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Loader2, LayoutDashboard, MessageSquare, Settings, User, LogOut, Package, ShoppingCart, Flame, Menu, X } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

function WaIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="#fff">
      <path d="M16 5.5C10.2 5.5 5.5 10.2 5.5 16c0 1.85.49 3.66 1.42 5.25L5.5 26.5l5.4-1.4A10.4 10.4 0 0 0 16 26.5c5.8 0 10.5-4.7 10.5-10.5S21.8 5.5 16 5.5zm0 19.1a8.6 8.6 0 0 1-4.4-1.2l-.31-.18-3.2.83.86-3.12-.2-.32A8.55 8.55 0 0 1 7.4 16a8.6 8.6 0 1 1 8.6 8.6zm4.7-6.43c-.26-.13-1.52-.75-1.76-.84-.24-.09-.41-.13-.58.13s-.66.84-.81 1.01c-.15.17-.3.19-.55.06-.26-.13-1.08-.4-2.06-1.27a7.72 7.72 0 0 1-1.43-1.77c-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.58-1.39-.79-1.9-.21-.5-.42-.43-.58-.44h-.49a.94.94 0 0 0-.68.32c-.23.26-.89.86-.89 2.1s.91 2.44 1.04 2.6c.13.17 1.79 2.73 4.34 3.82.61.26 1.08.42 1.45.54.61.19 1.16.16 1.6.1.49-.07 1.52-.62 1.73-1.22.21-.6.21-1.11.15-1.22-.06-.11-.24-.17-.5-.3z" />
    </svg>
  )
}

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/conversations', label: 'Conversații', icon: MessageSquare },
  { href: '/products', label: 'Catalog', icon: Package },
  { href: '/orders', label: 'Comenzi', icon: ShoppingCart },
  { href: '/leads', label: 'Lead-uri', icon: Flame },
  { href: '/settings', label: 'Setări', icon: Settings },
  { href: '/profile', label: 'Profil', icon: User },
]

// Drawer de navigare — același pe desktop și mobile (deschis prin hamburger din top bar).
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
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
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
          <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0" style={{ background: '#25D366' }}>
              <WaIcon size={18} />
            </span>
            <span className="font-mono-ui text-[18px] font-semibold text-ink">
              wa<span className="text-acid">ai.</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="p-2 text-dimmer hover:text-ink hover:bg-cardhi rounded-lg transition-colors"
            aria-label="Închide meniul"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl font-mono-ui text-[14px] transition-colors ${
                  active ? 'bg-cardhi text-ink' : 'text-dim hover:text-ink hover:bg-cardhi'
                }`}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${active ? 'text-acid' : ''}`} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom — doar email (toggle + deconectare au trecut în top bar, ca în admin) */}
        {userEmail && (
          <div className="p-3 border-t border-line">
            <p className="font-mono-ui text-[11px] text-dimmer px-3 py-1 truncate">{userEmail}</p>
          </div>
        )}
      </aside>
    </>
  )
}

// Top bar consistent — același pe desktop și mobile.
// ThemeToggle + deconectare sunt aici, în dreapta (la fel ca în pagina de admin).
function TopBar({ onMenu, onLogout }: { onMenu: () => void; onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-base/90 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenu}
            className="p-2 -ml-1 text-dim hover:text-ink hover:bg-cardhi rounded-lg transition-colors"
            aria-label="Deschide meniul"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full" style={{ background: '#25D366' }}>
              <WaIcon size={16} />
            </span>
            <span className="font-mono-ui text-[16px] font-semibold text-ink">
              wa<span className="text-acid">ai.</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
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

  // Închide meniul la schimbarea paginii
  useEffect(() => { setMenuOpen(false) }, [pathname])

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
    api.billing.getSubscription(accessToken!).then(({ subscription }) => {
      const needsSubscription = !subscription || subscription.status === 'incomplete'
      if (needsSubscription) {
        subVerified.current = false
        router.replace('/subscribe')
      } else {
        subVerified.current = true
        setChecking(false)
      }
    }).catch(() => {
      subVerified.current = true
      setChecking(false)
    })
  }, [isAuthenticated, accessToken, user, pathname, searchParams, router, _hasHydrated, setAuth, clearAuth])

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
    <div className="min-h-screen bg-base flex flex-col">
      <TopBar onMenu={() => setMenuOpen(true)} onLogout={handleLogout} />
      <NavDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        pathname={pathname}
        userEmail={user?.email}
      />

      <main className="flex-1 p-4 sm:p-6">
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
