'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Loader2, Sun, Moon } from 'lucide-react'

function WaIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="#fff">
      <path d="M16 5.5C10.2 5.5 5.5 10.2 5.5 16c0 1.85.49 3.66 1.42 5.25L5.5 26.5l5.4-1.4A10.4 10.4 0 0 0 16 26.5c5.8 0 10.5-4.7 10.5-10.5S21.8 5.5 16 5.5zm0 19.1a8.6 8.6 0 0 1-4.4-1.2l-.31-.18-3.2.83.86-3.12-.2-.32A8.55 8.55 0 0 1 7.4 16a8.6 8.6 0 1 1 8.6 8.6zm4.7-6.43c-.26-.13-1.52-.75-1.76-.84-.24-.09-.41-.13-.58.13s-.66.84-.81 1.01c-.15.17-.3.19-.55.06-.26-.13-1.08-.4-2.06-1.27a7.72 7.72 0 0 1-1.43-1.77c-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.58-1.39-.79-1.9-.21-.5-.42-.43-.58-.44h-.49a.94.94 0 0 0-.68.32c-.23.26-.89.86-.89 2.1s.91 2.44 1.04 2.6c.13.17 1.79 2.73 4.34 3.82.61.26 1.08.42 1.45.54.61.19 1.16.16 1.6.1.49-.07 1.52-.62 1.73-1.22.21-.6.21-1.11.15-1.22-.06-.11-.24-.17-.5-.3z" />
    </svg>
  )
}

function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => { setDark(document.documentElement.classList.contains('dark')) }, [])
  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('wa-ai-theme', next ? 'dark' : 'light')
  }
  return (
    <button onClick={toggle} className="p-2 text-dim hover:text-ink hover:bg-cardhi rounded-lg transition-colors">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/connect', label: 'WhatsApp' },
  { href: '/conversations', label: 'Conversații' },
  { href: '/settings', label: 'Setări' },
]

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

    if (!subVerified.current) {
      setChecking(true)
    }

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

  if (!isAuthenticated || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <Loader2 className="h-5 w-5 animate-spin text-acid" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base">
      <nav className="border-b border-line px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: '#25D366' }}>
              <WaIcon size={16} />
            </span>
            <span className="font-mono-ui text-[14px] font-medium text-ink">
              WhatsApp<span className="text-acid"> AI</span>
            </span>
          </Link>
          <div className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`font-mono-ui text-[12px] tracking-wide px-3 py-1.5 rounded-lg transition-colors ${
                  pathname === link.href
                    ? 'bg-cardhi text-ink'
                    : 'text-dim hover:text-ink hover:bg-cardhi'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </nav>
      <main className="p-6">{children}</main>
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

function LogoutButton() {
  const router = useRouter()
  const clearAuth = useAuthStore(s => s.clearAuth)

  async function handleLogout() {
    try {
      const { api } = await import('@/lib/api')
      await api.auth.logout()
    } catch {}
    clearAuth()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="font-mono-ui text-[12px] text-dim hover:text-ink transition-colors"
    >
      deconectare
    </button>
  )
}
