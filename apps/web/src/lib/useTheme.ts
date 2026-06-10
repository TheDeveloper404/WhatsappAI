'use client'
import { useSyncExternalStore } from 'react'

// Sursa de adevăr a temei = clasa `dark` pe <html> (adăugată pre-hidratare de scriptul din `layout.tsx`,
// apoi comutată de `toggleTheme`). O citim prin `useSyncExternalStore` ca să respectăm
// `react-hooks/set-state-in-effect` FĂRĂ hydration mismatch: server snapshot = `false` (HTML-ul de la
// server n-are încă clasa), iar clientul re-randă post-hidratare cu valoarea reală. Un MutationObserver
// pe atributul `class` notifică React când tema se schimbă (din orice buton de toggle din pagină).

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains('dark')
}

function getServerSnapshot(): boolean {
  return false
}

export function useDarkMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

// Comută tema pe <html> și persistă preferința. `no-transition` evită flash-ul de tranziție de culoare
// la comutare. Nu setează niciun state React — `useDarkMode` reflectă schimbarea prin MutationObserver.
export function toggleTheme(dark: boolean): void {
  const root = document.documentElement
  root.classList.add('no-transition')
  root.classList.toggle('dark', dark)
  window.requestAnimationFrame(() => root.classList.remove('no-transition'))
  try {
    localStorage.setItem('wa-ai-theme', dark ? 'dark' : 'light')
  } catch {
    /* localStorage indisponibil (mod privat) — tema rămâne pe sesiune */
  }
}
