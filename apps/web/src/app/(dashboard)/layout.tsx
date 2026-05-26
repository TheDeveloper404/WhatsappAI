'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Loader2 } from 'lucide-react'

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user, isAuthenticated, accessToken, _hasHydrated, setAuth, clearAuth } = useAuthStore()
  const [checking, setChecking] = useState(true)

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
      setChecking(false)
      return
    }

    api.billing.getSubscription(accessToken!).then(({ subscription }) => {
      const needsSubscription = !subscription || subscription.status === 'incomplete'
      if (needsSubscription) router.replace('/subscribe')
      else setChecking(false)
    }).catch(() => setChecking(false))
  }, [isAuthenticated, accessToken, user, pathname, searchParams, router, _hasHydrated, setAuth, clearAuth])

  if (!isAuthenticated || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M20.52 3.48A11.93 11.93 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.1 1.51 5.82L0 24l6.34-1.66A11.93 11.93 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52z" fill="white"/>
              </svg>
            </div>
            <span className="font-semibold text-gray-900">WhatsApp AI</span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <Link href="/dashboard" className={`text-sm font-medium transition-colors ${pathname === '/dashboard' ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}>
              Dashboard
            </Link>
            <Link href="/connect" className={`text-sm font-medium transition-colors ${pathname === '/connect' ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}>
              WhatsApp
            </Link>
            <Link href="/conversations" className={`text-sm font-medium transition-colors ${pathname === '/conversations' ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}>
              Conversații
            </Link>
            <Link href="/settings" className={`text-sm font-medium transition-colors ${pathname === '/settings' ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}>
              Setări
            </Link>
          </div>
        </div>
        <LogoutButton />
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
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
      className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
    >
      Deconectare
    </button>
  )
}
