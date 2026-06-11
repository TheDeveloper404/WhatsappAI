'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api, type AppNotification } from '@/lib/api'

// Clopoțel de notificări în-app pentru dashboard (B15). Oglindește pattern-ul din admin:
// listă (max 50) + badge necitite; la deschidere marchează tot ca citit. Best-effort —
// orice eroare de rețea e înghițită silențios (notificările nu sunt o cale critică).
export function NotificationBell() {
  const { accessToken } = useAuthStore()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      const data = await api.notifications.list(accessToken)
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {
      // silențios — fără notificări afișate
    }
  }, [accessToken])

  // Fetch on mount. setState-urile din `load` sunt DUPĂ `await` (async), nu sincrone — regula e conservativă
  // pe funcția apelată și nu urmărește granița await. Disable documentat (vezi BACKLOG 0.5).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Închidere la click în afară + ESC.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function toggle() {
    const next = !open
    setOpen(next)
    // La deschidere, dacă există necitite → marchează tot citit (optimist pe UI).
    if (next && unreadCount > 0 && accessToken) {
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => (n.readAt ? n : { ...n, readAt: Date.now() })))
      await api.notifications.markAllRead(accessToken).catch(() => {})
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggle}
        className="relative p-2 text-dim hover:text-ink hover:bg-cardhi rounded-lg transition-colors"
        aria-label="Notificări"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-3.5 w-3.5 bg-(--danger) text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 w-auto sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-80 bg-base border border-line rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <p className="font-mono-ui text-xs font-semibold text-ink">Notificări</p>
            {unreadCount === 0 && <span className="font-mono-ui text-xs text-dimmer">Toate citite</span>}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-line">
            {notifications.length === 0
              ? <p className="font-mono-ui text-xs text-dimmer text-center py-8">Nicio notificare</p>
              : notifications.map(n => (
                <div key={n.id} className={`px-4 py-3 ${!n.readAt ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-400 dark:border-blue-600' : ''}`}>
                  <p className="font-mono-ui text-xs font-medium text-ink">{n.title}</p>
                  <p className="font-mono-ui text-xs text-dim mt-0.5 whitespace-pre-wrap">{n.body}</p>
                  <p className="font-mono-ui text-[10px] text-dimmer mt-1">{new Date(n.createdAt).toLocaleString('ro-RO')}</p>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
