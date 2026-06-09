'use client'

export function BackButton() {
  const handleBack = async (e: React.MouseEvent) => {
    e.preventDefault()
    sessionStorage.setItem('scrollToFooter', '1')
    document.body.style.transition = 'opacity 0.18s ease'
    document.body.style.opacity = '0'
    await new Promise(r => setTimeout(r, 180))
    window.location.href = '/'
  }

  return (
    // Navigare intenționat JS-driven (fade-out apoi window.location.href); `href` e doar fallback
    // semantic/accesibilitate. `next lint` nu o semnala; plain eslint da → suprimare țintită.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      href="/"
      onClick={handleBack}
      className="font-mono-ui text-[12px] text-dimmer hover:text-ink transition-colors mb-10 inline-block"
    >
      ← înapoi
    </a>
  )
}
