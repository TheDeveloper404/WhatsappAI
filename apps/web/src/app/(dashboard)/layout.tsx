'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Loader2, LayoutDashboard, MessageSquare, Settings, User, LogOut } from 'lucide-react'
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
  { href: '/settings', label: 'Setări', icon: Settings },
  { href: '/profile', label: 'Profil', icon: User },
]

function Sidebar({ pathname, onLogout, userEmail }: { pathname: string; onLogout: () => void; userEmail?: string }) {
  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-[220px] border-r border-line bg-base z-20">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-line">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0" style={{ background: '#25D366' }}>
            <WaIcon size={18} />
          </span>
          <span className="font-mono-ui text-[18px] font-semibold text-ink">
            wa<span className="text-acid">ai.</span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-mono-ui text-[13px] transition-colors ${
                active ? 'bg-cardhi text-ink' : 'text-dim hover:text-ink hover:bg-cardhi'
              }`}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-acid' : ''}`} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-line space-y-1">
        {userEmail && (
          <p className="font-mono-ui text-[10px] text-dimmer px-3 py-1 truncate">{userEmail}</p>
        )}
        <div className="flex items-center justify-between px-3 py-1">
          <button
            onClick={onLogout}
            className="flex items-center gap-2 font-mono-ui text-[12px] text-dim hover:text-red-500 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            deconectare
          </button>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-base flex">
      {NAV_LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${
              active ? 'text-ink' : 'text-dimmer hover:text-dim'
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? 'text-acid' : ''}`} />
            <span className="font-mono-ui text-[9px]">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user, isAuthenticated, accessToken, _hasHydrated, setAuth, clearAuth } = useAuthStore()
  const [checking, setChecking] = useState(true)
  const subVerified = useRef(false)

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
  // Covers: initial load, token refresh in progress, session expired.
  // Layout is shown only once isAuthenticated=true (after a valid access token exists).
  if (!_hasHydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <Loader2 className="h-5 w-5 animate-spin text-acid" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base flex">
      <Sidebar pathname={pathname} onLogout={handleLogout} userEmail={user?.email} />

      <div className="flex-1 lg:ml-[220px] flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <div className="lg:hidden border-b border-line px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full" style={{ background: '#25D366' }}>
              <WaIcon size={16} />
            </span>
            <span className="font-mono-ui text-[16px] font-semibold text-ink">
              wa<span className="text-acid">ai.</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="p-2 text-dim hover:text-red-500 hover:bg-cardhi rounded-lg transition-colors"
              title="Deconectare"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <main className="flex-1 p-6 pb-24 lg:pb-6">
          {checking ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-acid" />
            </div>
          ) : children}
        </main>
      </div>

      <BottomNav pathname={pathname} />
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
