'use client'
import { Sun, Moon } from 'lucide-react'
import { useDarkMode, toggleTheme } from '@/lib/useTheme'

export function ThemeToggle() {
  const dark = useDarkMode()
  return (
    <button onClick={() => toggleTheme(!dark)} className="p-2 text-dim hover:text-ink hover:bg-cardhi rounded-lg transition-colors" title={dark ? 'Mod luminos' : 'Mod întunecat'}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
