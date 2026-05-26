'use client'

export function BackButton() {
  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault()
    sessionStorage.setItem('scrollToFooter', '1')
    window.location.href = '/'
  }

  return (
    <a
      href="/"
      onClick={handleBack}
      className="font-mono-ui text-[12px] text-dimmer hover:text-ink transition-colors mb-10 inline-block"
    >
      ← înapoi
    </a>
  )
}
