import { NextRequest, NextResponse } from 'next/server'

// Defense-in-depth (M3): blochează la EDGE accesul la rutele de dashboard fără sesiune, ÎNAINTE de
// orice render. Garanția reală de autorizare rămâne API-ul (C1/C2) + verificarea din `(dashboard)/
// layout.tsx`; aici doar evităm să randăm shell-ul aplicației pentru un vizitator neautentificat
// (înainte pagina se randa, apoi JS-ul redirecționa — fereastră vizuală + muncă inutilă).
//
// Sesiunea durabilă = cookie-ul httpOnly `refreshToken` (access token-ul stă DOAR în memorie; store-ul
// Zustand persistă doar `user`). Verificare OPTIMISTĂ pe prezența cookie-ului — nu validăm criptografic
// token-ul aici (n-avem secretul la edge și n-ar trebui să lovim API-ul pe fiecare cerere). Un cookie
// expirat trece de edge, dar e prins apoi de refresh-ul din layout / de API.
const REFRESH_COOKIE = 'refreshToken'

// Prefixele rutelor de dashboard (grupul `(dashboard)` — numele grupului nu apare în URL).
const PROTECTED_PREFIXES = [
  '/dashboard', '/conversations', '/leads', '/products',
  '/orders', '/appointments', '/settings', '/profile', '/subscribe',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!isProtected) return NextResponse.next()

  if (request.cookies.get(REFRESH_COOKIE)?.value) return NextResponse.next()

  return NextResponse.redirect(new URL('/login', request.nextUrl))
}

export const config = {
  // Rulează pe rutele de pagină; exclude API, interne Next și fișiere cu extensie (assets).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
}
