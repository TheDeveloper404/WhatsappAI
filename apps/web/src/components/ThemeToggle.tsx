'use client'
import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => { setDark(document.documentElement.classList.contains('dark')) }, [])
  function toggle() {
    const next = !dark
    const root = document.documentElement
    root.classList.add('no-transition')
    root.classList.toggle('dark', next)
    window.requestAnimationFrame(() => root.classList.remove('no-transition'))
    setDark(next)
    localStorage.setItem('wa-ai-theme', next ? 'dark' : 'light')
  }
  return (
    <button onClick={toggle} className="p-2 text-dim hover:text-ink hover:bg-cardhi rounded-lg transition-colors" title={dark ? 'Mod luminos' : 'Mod întunecat'}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
