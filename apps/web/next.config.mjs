/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // F3: `Content-Security-Policy` e setat DINAMIC în `proxy.ts` (nonce per-request, fără
          // `'unsafe-inline'` pe script-src). Nu-l mai punem static aici — un al doilea header CSP cu
          // `'unsafe-inline'` ar relaxa politica și ar anula efectul nonce-ului.
        ],
      },
    ]
  },
}

export default nextConfig
