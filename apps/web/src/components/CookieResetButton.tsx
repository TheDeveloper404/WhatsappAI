'use client'

// Buton mic de reset al consimțământului pentru cookies. Izolat ca client component ca pagina
// `/cookies` să rămână server component (poate exporta `metadata`), consecvent cu celelalte
// pagini legale.
export function CookieResetButton() {
  return (
    <button
      onClick={() => {
        localStorage.removeItem('wa-ai-cookie-consent')
        window.location.reload()
      }}
      className="mt-5 font-mono-ui text-[13px] border border-line text-ink px-5 py-2.5 rounded-full hover:bg-cardhi transition-colors"
    >
      resetează preferințele cookies
    </button>
  )
}
