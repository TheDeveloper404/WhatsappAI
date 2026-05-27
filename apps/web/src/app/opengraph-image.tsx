import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'waai. — răspunde singur. cu tonul tău.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0D1110',
          position: 'relative',
        }}
      >
        {/* subtle grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(200,251,74,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(200,251,74,0.04) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* logo pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#25D366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 32 32" width={36} height={36} fill="#fff">
              <path d="M16 5.5C10.2 5.5 5.5 10.2 5.5 16c0 1.85.49 3.66 1.42 5.25L5.5 26.5l5.4-1.4A10.4 10.4 0 0 0 16 26.5c5.8 0 10.5-4.7 10.5-10.5S21.8 5.5 16 5.5zm0 19.1a8.6 8.6 0 0 1-4.4-1.2l-.31-.18-3.2.83.86-3.12-.2-.32A8.55 8.55 0 0 1 7.4 16a8.6 8.6 0 1 1 8.6 8.6zm4.7-6.43c-.26-.13-1.52-.75-1.76-.84-.24-.09-.41-.13-.58.13s-.66.84-.81 1.01c-.15.17-.3.19-.55.06-.26-.13-1.08-.4-2.06-1.27a7.72 7.72 0 0 1-1.43-1.77c-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.58-1.39-.79-1.9-.21-.5-.42-.43-.58-.44h-.49a.94.94 0 0 0-.68.32c-.23.26-.89.86-.89 2.1s.91 2.44 1.04 2.6c.13.17 1.79 2.73 4.34 3.82.61.26 1.08.42 1.45.54.61.19 1.16.16 1.6.1.49-.07 1.52-.62 1.73-1.22.21-.6.21-1.11.15-1.22-.06-.11-.24-.17-.5-.3z" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 64,
              fontWeight: 700,
              color: '#E8E6E1',
              letterSpacing: '-2px',
            }}
          >
            wa<span style={{ color: '#C8FB4A' }}>ai.</span>
          </span>
        </div>

        {/* tagline */}
        <p
          style={{
            fontFamily: 'sans-serif',
            fontSize: 28,
            color: '#9B9B8F',
            margin: 0,
            letterSpacing: '-0.5px',
            textAlign: 'center',
            maxWidth: 720,
          }}
        >
          Răspunde singur la WhatsApp.{' '}
          <span style={{ color: '#E8E6E1' }}>Cu tonul tău.</span>
        </p>

        {/* bottom badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(200,251,74,0.08)',
            border: '1px solid rgba(200,251,74,0.2)',
            borderRadius: 99,
            padding: '8px 20px',
          }}
        >
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 16,
              color: '#C8FB4A',
              letterSpacing: '0.5px',
            }}
          >
            waai.ro
          </span>
        </div>
      </div>
    ),
    { ...size },
  )
}
