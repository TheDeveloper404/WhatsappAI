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
          // F3: scos `'unsafe-eval'` din script-src (producția Next nu-l cere; era nevoie doar în dev
          // pt React Refresh). `'unsafe-inline'` rămâne deocamdată — eliminarea lui cere CSP cu nonce
          // prin middleware (App Router emite scripturi inline de streaming/hydration). Verifică pe
          // un preview Vercel după build că nimic nu pică silențios în consolă.
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; connect-src 'self' https:; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'" },
        ],
      },
    ]
  },
}

export default nextConfig
