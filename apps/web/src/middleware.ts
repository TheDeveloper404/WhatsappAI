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

// F3 (audit pentester): CSP cu nonce per-request ca să eliminăm `'unsafe-inline'` din `script-src`.
// `'strict-dynamic'` face ca scripturile încărcate de un script semnat cu nonce să fie de încredere
// (browserele care-l suportă ignoră allowlist-ul pe host — va.vercel-scripts.com rămâne ca fallback
// pentru cele vechi; Analytics-ul Vercel e încărcat de Next, care îi propagă automat nonce-ul).
// `style-src 'unsafe-inline'` rămâne intenționat: scoaterea lui în App Router e fragilă (stiluri
// inline fără nonce → FOUC) și e risc mic. Nonce-ul forțează randare dinamică pe paginile randate.
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://va.vercel-scripts.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' https:",
    "font-src 'self' https://fonts.gstatic.com",
    "frame-ancestors 'none'",
  ].join('; ')
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))

  // Auth gate: redirect-ul vizitatorilor neautentificați se face înainte de orice render (fără CSP —
  // răspunsul n-are body HTML).
  if (isProtected && !request.cookies.get(REFRESH_COOKIE)?.value) {
    return NextResponse.redirect(new URL('/login', request.nextUrl))
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCsp(nonce)

  // Nonce-ul trece la render prin header-ul `x-nonce` (layout.tsx îl pune pe scriptul inline de temă);
  // Next citește CSP-ul din request și semnează automat scripturile framework-ului (hydration/RSC).
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  // Rulează pe rutele de pagină; exclude API, interne Next și fișiere cu extensie (assets).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
}
