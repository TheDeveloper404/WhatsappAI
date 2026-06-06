'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Users, Bot, CreditCard, RefreshCw, Bell, LogOut, Phone,
  CheckCircle, XCircle, Clock, AlertCircle, TrendingUp, ChevronDown,
  Mail, Trash2, WifiOff, CalendarPlus, Settings, Save, X, Eye,
  Activity, MessageSquare, ShieldCheck, Smartphone, AlertTriangle,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface AdminUser {
  id: string; name: string; email: string; createdAt: number
  subscriptionStatus: string | null; subscriptionPlan: string | null
  trialEndsAt: number | null; currentPeriodEndsAt: number | null
  cancelAtPeriodEnd: boolean | null; cancelAt: number | null
  sessionStatus: string | null; sessionPhone: string | null; sessionConnectedAt: number | null
  agentActive: boolean | null; agentAdminDisabled: boolean | null
  agentTimerMinutes: number | null; agentSystemPrompt: string | null
  agentKnowledgeBase: string | null; agentWritingStyle: string | null
  agentNotifyOnAiTakeover: boolean | null
}

interface AdminStats {
  totalUsers: number; activeSubscribers: number; inTrial: number
  pastDue: number; activeAgents: number; mrr: number
  conversionRate: number; newThisMonth: number
  connectedWhatsapp: number; pairingWhatsapp: number; disconnectedWhatsapp: number
  activeAgentsWithoutWhatsapp: number; trialsExpiringSoon: number
  cancelingSubscriptions: number; monthlySubscribers: number; annualSubscribers: number
  messagesToday: number; aiMessagesToday: number; ownerMessagesToday: number
  totalConversations: number
}

interface AdminNotification {
  id: string; title: string; body: string; type: string
  readAt: number | null; createdAt: number
}

interface PlatformConfig { [key: string]: string }

type ModalState =
  | { type: 'email'; user: AdminUser }
  | { type: 'trial'; user: AdminUser }
  | { type: 'delete'; user: AdminUser }
  | { type: 'details'; user: AdminUser }
  | null

async function adminFetch(path: string, token: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}/api/v1/admin${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options?.headers ?? {}) },
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (res.status === 204) return {}
  return res.json()
}

const SUB_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  trialing:   { label: 'Trial',     color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',       icon: Clock },
  active:     { label: 'Activ',     color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',    icon: CheckCircle },
  past_due:   { label: 'Restanță',  color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',           icon: AlertCircle },
  canceled:   { label: 'Anulat',    color: 'bg-cardhi text-dimmer',                                                   icon: XCircle },
  incomplete: { label: 'Incomplet', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300', icon: AlertCircle },
}

function SubBadge({ status }: { status: string | null }) {
  const cfg = SUB_CONFIG[status ?? ''] ?? { label: '—', color: 'bg-cardhi text-dimmer', icon: XCircle }
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" />{cfg.label}
    </span>
  )
}

function formatDate(ts: number | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function trialDaysLeft(trialEndsAt: number | null) {
  if (!trialEndsAt) return null
  const days = Math.ceil((trialEndsAt - Date.now()) / 86_400_000)
  if (days <= 0) return 'expirat'
  return `${days}z`
}

const inputCls = 'w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-cardhi placeholder:text-dimmer focus:outline-none focus:ring-2 focus:ring-acid/40 focus:border-acid transition-colors'
const btnSecondary = 'px-4 py-2 text-sm font-mono-ui text-dim hover:text-ink hover:bg-cardhi rounded-lg transition-colors'

// ─── Modal email ─────────────────────────────────────────────────────────────
function EmailModal({ user, token, onClose }: { user: AdminUser; token: string; onClose: () => void }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function send() {
    if (!subject.trim() || !body.trim()) return
    setLoading(true)
    try {
      await adminFetch(`/users/${user.id}/email`, token, { method: 'POST', body: JSON.stringify({ subject, body }) })
      setDone(true)
      setTimeout(onClose, 1200)
    } catch {}
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-base border border-line rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h3 className="font-mono-ui text-sm font-semibold text-ink">Trimite email — {user.name}</h3>
          <button onClick={onClose} className="text-dimmer hover:text-ink transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="font-mono-ui text-xs text-dimmer">Către: {user.email}</p>
          <input placeholder="Subiect" value={subject} onChange={e => setSubject(e.target.value)} className={inputCls} />
          <textarea placeholder="Mesaj..." value={body} onChange={e => setBody(e.target.value)} rows={5} className={`${inputCls} resize-none`} />
        </div>
        <div className="px-6 py-4 border-t border-line flex justify-end gap-2">
          <button onClick={onClose} className={btnSecondary}>Anulează</button>
          <button
            onClick={send}
            disabled={loading || done || !subject.trim() || !body.trim()}
            className="px-4 py-2 text-sm font-mono-ui rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition-opacity hover:opacity-90"
            style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <CheckCircle className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
            {done ? 'Trimis!' : 'Trimite'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal extindere trial ────────────────────────────────────────────────────
function TrialModal({ user, token, onClose, onDone }: { user: AdminUser; token: string; onClose: () => void; onDone: () => void }) {
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(false)

  async function extend() {
    setLoading(true)
    try {
      await adminFetch(`/users/${user.id}/extend-trial`, token, { method: 'POST', body: JSON.stringify({ days }) })
      onDone(); onClose()
    } catch {}
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-base border border-line rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h3 className="font-mono-ui text-sm font-semibold text-ink">Extinde trial — {user.name}</h3>
          <button onClick={onClose} className="text-dimmer hover:text-ink transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5">
          <label className="font-mono-ui text-xs text-dim block mb-2">Număr de zile de adăugat</label>
          <input type="number" min={1} max={365} value={days} onChange={e => setDays(Number(e.target.value))} className={inputCls} />
          {user.trialEndsAt && (
            <p className="font-mono-ui text-xs text-dimmer mt-2">
              Expiră acum: {formatDate(user.trialEndsAt)}
              {' → '}
              {formatDate(Math.max(user.trialEndsAt, Date.now()) + days * 86_400_000)}
            </p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-line flex justify-end gap-2">
          <button onClick={onClose} className={btnSecondary}>Anulează</button>
          <button
            onClick={extend}
            disabled={loading}
            className="px-4 py-2 text-sm font-mono-ui rounded-lg disabled:opacity-50 flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Extinde
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal ștergere cont ──────────────────────────────────────────────────────
function DeleteModal({ user, token, onClose, onDone }: { user: AdminUser; token: string; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false)

  async function doDelete() {
    setLoading(true)
    try {
      await adminFetch(`/users/${user.id}`, token, { method: 'DELETE' })
      onDone(); onClose()
    } catch {}
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-base border border-line rounded-2xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-5">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="font-mono-ui text-sm font-semibold text-ink">Șterge contul lui {user.name}?</h3>
          <p className="font-mono-ui text-xs text-dim mt-2">Acțiune ireversibilă. Toate datele (subscripție, sesiune WA, mesaje) vor fi șterse.</p>
        </div>
        <div className="px-6 py-4 border-t border-line flex justify-end gap-2">
          <button onClick={onClose} className={btnSecondary}>Anulează</button>
          <button
            onClick={doDelete}
            disabled={loading}
            className="px-4 py-2 text-sm font-mono-ui bg-[var(--danger)] text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Șterge definitiv
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal detalii user ───────────────────────────────────────────────────────
function UserDetailsModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const prompt = user.agentSystemPrompt?.trim()
  const knowledgeBase = user.agentKnowledgeBase?.trim()
  const writingStyle = user.agentWritingStyle?.trim()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-base border border-line rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <h3 className="font-mono-ui text-sm font-semibold text-ink">{user.name}</h3>
            <p className="font-mono-ui text-xs text-dimmer mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-dimmer hover:text-ink transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-73px)] space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="border border-line rounded-xl p-4 bg-cardhi">
              <p className="font-mono-ui text-[10px] text-dimmer uppercase tracking-widest mb-3">Billing</p>
              <div className="space-y-2 font-mono-ui text-xs text-dim">
                <div className="flex justify-between gap-3"><span>Status</span><SubBadge status={user.subscriptionStatus} /></div>
                <div className="flex justify-between gap-3"><span>Plan</span><span className="text-ink">{user.subscriptionPlan ?? '—'}</span></div>
                <div className="flex justify-between gap-3"><span>Trial</span><span className="text-ink">{formatDate(user.trialEndsAt)}</span></div>
                <div className="flex justify-between gap-3"><span>Perioadă</span><span className="text-ink">{formatDate(user.currentPeriodEndsAt)}</span></div>
                <div className="flex justify-between gap-3"><span>Anulare</span><span className="text-ink">{user.cancelAtPeriodEnd ? formatDate(user.cancelAt) : 'nu'}</span></div>
              </div>
            </div>

            <div className="border border-line rounded-xl p-4 bg-cardhi">
              <p className="font-mono-ui text-[10px] text-dimmer uppercase tracking-widest mb-3">WhatsApp</p>
              <div className="space-y-2 font-mono-ui text-xs text-dim">
                <div className="flex justify-between gap-3"><span>Status</span><span className="text-ink">{user.sessionStatus ?? '—'}</span></div>
                <div className="flex justify-between gap-3"><span>Telefon</span><span className="text-ink">{user.sessionPhone ?? '—'}</span></div>
                <div className="flex justify-between gap-3"><span>Conectat</span><span className="text-ink">{formatDate(user.sessionConnectedAt)}</span></div>
              </div>
            </div>

            <div className="border border-line rounded-xl p-4 bg-cardhi">
              <p className="font-mono-ui text-[10px] text-dimmer uppercase tracking-widest mb-3">Agent</p>
              <div className="space-y-2 font-mono-ui text-xs text-dim">
                <div className="flex justify-between gap-3"><span>Status</span><span className="text-ink">{user.agentAdminDisabled ? 'blocat admin' : user.agentActive ? 'activ' : 'inactiv'}</span></div>
                <div className="flex justify-between gap-3"><span>Timer</span><span className="text-ink">{user.agentTimerMinutes ?? '—'} min</span></div>
                <div className="flex justify-between gap-3"><span>Notifică preluare</span><span className="text-ink">{user.agentNotifyOnAiTakeover == null ? '—' : user.agentNotifyOnAiTakeover ? 'da' : 'nu'}</span></div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { title: 'Prompt user', value: prompt, empty: 'Niciun prompt setat.' },
              { title: 'Knowledge base', value: knowledgeBase, empty: 'Nicio bază de cunoștințe.' },
              { title: 'Stil de scriere', value: writingStyle, empty: 'Niciun stil salvat.' },
            ].map(item => (
              <div key={item.title} className="border border-line rounded-xl p-4 bg-base">
                <p className="font-mono-ui text-[10px] text-dimmer uppercase tracking-widest mb-3">{item.title}</p>
                <p className="font-mono-ui text-xs text-dim whitespace-pre-wrap max-h-56 overflow-y-auto">
                  {item.value || item.empty}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Dropdown acțiuni per user ────────────────────────────────────────────────
function ActionsDropdown({ user, token: _token, onModal, onDisconnect, onToggle, toggling }: {
  user: AdminUser; token: string
  onModal: (m: ModalState) => void
  onDisconnect: (userId: string) => void
  onToggle: (userId: string, current: boolean | null) => void
  toggling: string | null
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const act = (fn: () => void) => { setOpen(false); fn() }

  return (
    <div className="flex items-center gap-1.5" ref={ref}>
      <button
        onClick={() => onToggle(user.id, user.agentActive)}
        disabled={toggling === user.id}
        className={`inline-flex items-center gap-1 text-xs font-mono-ui px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
          user.agentActive
            ? 'border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
            : user.agentAdminDisabled
              ? 'border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30'
              : 'border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
        }`}
      >
        {toggling === user.id
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : user.agentActive
            ? <><XCircle className="h-3 w-3" />Dezactivează</>
            : user.agentAdminDisabled
              ? <><CheckCircle className="h-3 w-3" />Reactivează</>
              : <><CheckCircle className="h-3 w-3" />Activează</>
        }
      </button>

      <div className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className="inline-flex items-center gap-0.5 text-xs font-mono-ui px-2 py-1.5 rounded-lg border border-line text-dim bg-cardhi hover:bg-card hover:text-ink transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {open && (
          <div className="absolute right-0 top-8 w-44 bg-base border border-line rounded-xl shadow-lg z-20 overflow-hidden">
            <button onClick={() => act(() => onModal({ type: 'details', user }))} className="w-full flex items-center gap-2 px-3 py-2.5 font-mono-ui text-xs text-dim hover:bg-cardhi hover:text-ink transition-colors">
              <Eye className="h-3.5 w-3.5 text-acid" />Detalii user
            </button>
            <div className="border-t border-line" />
            <button onClick={() => act(() => onModal({ type: 'trial', user }))} className="w-full flex items-center gap-2 px-3 py-2.5 font-mono-ui text-xs text-dim hover:bg-cardhi hover:text-ink transition-colors">
              <CalendarPlus className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />Extinde trial
            </button>
            <button onClick={() => act(() => onModal({ type: 'email', user }))} className="w-full flex items-center gap-2 px-3 py-2.5 font-mono-ui text-xs text-dim hover:bg-cardhi hover:text-ink transition-colors">
              <Mail className="h-3.5 w-3.5 text-acid" />Trimite email
            </button>
            {user.sessionStatus === 'connected' && (
              <button onClick={() => act(() => onDisconnect(user.id))} className="w-full flex items-center gap-2 px-3 py-2.5 font-mono-ui text-xs text-dim hover:bg-cardhi hover:text-ink transition-colors">
                <WifiOff className="h-3.5 w-3.5 text-yellow-500 dark:text-yellow-400" />Deconectează WA
              </button>
            )}
            <div className="border-t border-line" />
            <button onClick={() => act(() => onModal({ type: 'delete', user }))} className="w-full flex items-center gap-2 px-3 py-2.5 font-mono-ui text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />Șterge cont
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard principal ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [config, setConfig] = useState<PlatformConfig>({})
  const [configPrompt, setConfigPrompt] = useState('')
  const [configSaving, setConfigSaving] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deletingNotification, setDeletingNotification] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'activity' | 'config'>('overview')

  const loadAll = useCallback(async (t: string, silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [usersData, notifData, statsData, cfgData] = await Promise.all([
        adminFetch('/users', t),
        adminFetch('/notifications', t),
        adminFetch('/stats', t),
        adminFetch('/config', t),
      ])
      setUsers(usersData.users)
      setNotifications(notifData.notifications)
      setUnreadCount(notifData.unreadCount)
      setStats(statsData)
      setConfig(cfgData.config ?? {})
      setConfigPrompt(cfgData.config?.default_system_prompt ?? '')
    } catch {
      if (!silent) { sessionStorage.removeItem('admin_token'); router.replace('/admin') }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    const t = sessionStorage.getItem('admin_token')
    if (!t) { router.replace('/admin'); return }
    setToken(t)
    loadAll(t)
  }, [loadAll, router])

  async function toggleAgent(userId: string, current: boolean | null) {
    if (!token) return
    setToggling(userId)
    try {
      await adminFetch(`/users/${userId}/agent`, token, { method: 'PATCH', body: JSON.stringify({ isActive: !current }) })
      setUsers(prev => prev.map(u => u.id === userId
        ? { ...u, agentActive: !current, agentAdminDisabled: current ? false : true }
        : u))
    } catch {}
    setToggling(null)
  }

  async function disconnectWa(userId: string) {
    if (!token) return
    try {
      await adminFetch(`/users/${userId}/disconnect-wa`, token, { method: 'POST', body: '{}' })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, sessionStatus: 'disconnected' } : u))
    } catch {}
  }

  async function openBell() {
    setBellOpen(v => !v)
    if (!bellOpen && unreadCount > 0 && token) {
      await adminFetch('/notifications/read', token, { method: 'POST', body: '{}' }).catch(() => {})
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, readAt: Date.now() })))
    }
  }

  async function saveConfig() {
    if (!token || !configPrompt.trim()) return
    setConfigSaving(true)
    try {
      await adminFetch('/config', token, { method: 'PATCH', body: JSON.stringify({ default_system_prompt: configPrompt }) })
      setConfigSaved(true)
      setTimeout(() => setConfigSaved(false), 2000)
    } catch {}
    setConfigSaving(false)
  }

  async function deleteNotification(notificationId: string) {
    if (!token) return
    setDeletingNotification(notificationId)
    try {
      await adminFetch(`/notifications/${notificationId}`, token, { method: 'DELETE', body: '{}' })
      const removed = notifications.find(n => n.id === notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      if (removed && !removed.readAt) setUnreadCount(prev => Math.max(prev - 1, 0))
    } catch {}
    setDeletingNotification(null)
  }

  async function deleteAllNotifications() {
    if (!token || notifications.length === 0) return
    setDeletingNotification('all')
    try {
      await adminFetch('/notifications', token, { method: 'DELETE', body: '{}' })
      setNotifications([])
      setUnreadCount(0)
    } catch {}
    setDeletingNotification(null)
  }

  function logout() { sessionStorage.removeItem('admin_token'); router.replace('/admin') }

  const statCards = stats ? [
    { icon: Users,      label: 'Total useri',    value: stats.totalUsers,              sub: `+${stats.newThisMonth} luna aceasta` },
    { icon: CreditCard, label: 'Abonați activi', value: stats.activeSubscribers,       sub: `${stats.conversionRate}% conversie` },
    { icon: Clock,      label: 'În trial',        value: stats.inTrial,                sub: stats.pastDue > 0 ? `${stats.pastDue} cu restanță` : null },
    { icon: Bot,        label: 'Agenți activi',  value: stats.activeAgents,            sub: null },
    { icon: TrendingUp, label: 'MRR estimat',    value: `${stats.mrr.toFixed(0)} RON`, sub: 'echivalent lunar' },
  ] : []

  const usersNeedingAttention = users.filter(u =>
    u.subscriptionStatus === 'past_due' ||
    u.agentAdminDisabled ||
    (u.agentActive && u.sessionStatus !== 'connected') ||
    ((u.subscriptionStatus === 'active' || u.subscriptionStatus === 'trialing') && u.sessionStatus !== 'connected') ||
    (u.subscriptionStatus === 'trialing' && u.trialEndsAt && u.trialEndsAt - Date.now() <= 2 * 86_400_000)
  )

  const healthCards = stats ? [
    { icon: Smartphone, label: 'WhatsApp conectat', value: stats.connectedWhatsapp, sub: `${stats.disconnectedWhatsapp} fără sesiune` },
    { icon: Clock, label: 'În pairing', value: stats.pairingWhatsapp, sub: 'așteaptă conectare' },
    { icon: Bot, label: 'Agenți activi', value: stats.activeAgents, sub: `${stats.activeAgentsWithoutWhatsapp} fără WA conectat` },
  ] : []

  const productCards = stats ? [
    { icon: MessageSquare, label: 'Mesaje azi', value: stats.messagesToday, sub: `${stats.aiMessagesToday} trimise de AI` },
    { icon: ShieldCheck, label: 'Intervenții manuale azi', value: stats.ownerMessagesToday, sub: 'mesaje trimise de owner' },
    { icon: Activity, label: 'Conversații totale', value: stats.totalConversations, sub: 'contacte unice cu mesaje' },
  ] : []

  const billingCards = stats ? [
    { icon: AlertTriangle, label: 'Trial expiră <48h', value: stats.trialsExpiringSoon, sub: 'merită follow-up' },
    { icon: XCircle, label: 'Anulare la final', value: stats.cancelingSubscriptions, sub: 'încă au acces până expiră' },
    { icon: CreditCard, label: 'Planuri active', value: `${stats.monthlySubscribers}/${stats.annualSubscribers}`, sub: 'lunar / anual' },
  ] : []

  if (loading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-acid" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base">
      {modal?.type === 'email' && <EmailModal user={modal.user} token={token!} onClose={() => setModal(null)} />}
      {modal?.type === 'trial' && <TrialModal user={modal.user} token={token!} onClose={() => setModal(null)} onDone={() => token && loadAll(token, true)} />}
      {modal?.type === 'delete' && <DeleteModal user={modal.user} token={token!} onClose={() => setModal(null)} onDone={() => setUsers(prev => prev.filter(u => u.id !== modal.user.id))} />}
      {modal?.type === 'details' && <UserDetailsModal user={modal.user} onClose={() => setModal(null)} />}

      {/* Navbar */}
      <nav className="border-b border-line px-6 py-3.5 flex items-center justify-between sticky top-0 z-10 bg-base">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full" style={{ background: '#25D366' }}>
            <svg viewBox="0 0 32 32" width="20" height="20" fill="#fff">
              <path d="M16 5.5C10.2 5.5 5.5 10.2 5.5 16c0 1.85.49 3.66 1.42 5.25L5.5 26.5l5.4-1.4A10.4 10.4 0 0 0 16 26.5c5.8 0 10.5-4.7 10.5-10.5S21.8 5.5 16 5.5zm0 19.1a8.6 8.6 0 0 1-4.4-1.2l-.31-.18-3.2.83.86-3.12-.2-.32A8.55 8.55 0 0 1 7.4 16a8.6 8.6 0 1 1 8.6 8.6zm4.7-6.43c-.26-.13-1.52-.75-1.76-.84-.24-.09-.41-.13-.58.13s-.66.84-.81 1.01c-.15.17-.3.19-.55.06-.26-.13-1.08-.4-2.06-1.27a7.72 7.72 0 0 1-1.43-1.77c-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.58-1.39-.79-1.9-.21-.5-.42-.43-.58-.44h-.49a.94.94 0 0 0-.68.32c-.23.26-.89.86-.89 2.1s.91 2.44 1.04 2.6c.13.17 1.79 2.73 4.34 3.82.61.26 1.08.42 1.45.54.61.19 1.16.16 1.6.1.49-.07 1.52-.62 1.73-1.22.21-.6.21-1.11.15-1.22-.06-.11-.24-.17-.5-.3z" />
            </svg>
          </span>
          <span className="font-mono-ui text-[18px] font-semibold text-ink">wa<span className="text-acid">ai.</span></span>
          <span className="font-mono-ui text-[9px] tracking-widest px-2 py-0.5 rounded-full bg-cardhi text-dimmer border border-line">ADMIN</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={() => token && loadAll(token, true)}
            disabled={refreshing}
            className="p-2 text-dim hover:text-ink hover:bg-cardhi rounded-lg transition-colors"
            title="Reîncarcă"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative">
            <button onClick={openBell} className="relative p-2 text-dim hover:text-ink hover:bg-cardhi rounded-lg transition-colors">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-3.5 w-3.5 bg-[var(--danger)] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {bellOpen && (
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
          <button
            onClick={logout}
            className="flex items-center gap-1.5 font-mono-ui text-xs text-dim hover:text-ink hover:bg-cardhi px-3 py-2 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />Ieși
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="font-display text-[32px] text-ink leading-none">dashboard.</h1>
          <p className="font-mono-ui text-[12px] text-dim mt-1">{users.length} useri înregistrați</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {statCards.map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="card-elevated rounded-xl p-5">
              <div className="w-8 h-8 rounded-lg bg-cardhi flex items-center justify-center mb-3">
                <Icon className="h-4 w-4 text-acid" />
              </div>
              <p className="font-display text-[26px] text-ink leading-none">{value}</p>
              <p className="font-mono-ui text-[11px] text-dim mt-1">{label}</p>
              {sub && <p className="font-mono-ui text-[10px] text-dimmer mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-line">
          {([['overview', 'Overview', Activity], ['users', 'Useri', Users], ['activity', 'Activitate', Bell], ['config', 'Configurare', Settings]] as const).map(([tab, label, Icon]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 font-mono-ui text-xs tracking-wide border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-acid text-acid'
                  : 'border-transparent text-dim hover:text-ink'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>

        {/* ─── Tab: Overview ─── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="card-elevated rounded-xl overflow-hidden lg:col-span-2">
                <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-mono-ui text-sm font-semibold text-ink">Atenție necesară</h2>
                    <p className="font-mono-ui text-[10px] text-dimmer mt-0.5">{usersNeedingAttention.length} useri cu risc operațional sau billing</p>
                  </div>
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                </div>
                <div className="divide-y divide-line">
                  {usersNeedingAttention.length === 0 ? (
                    <p className="font-mono-ui text-xs text-dimmer text-center py-10">Nu există alerte active.</p>
                  ) : usersNeedingAttention.slice(0, 6).map(u => {
                    const reasons = [
                      u.subscriptionStatus === 'past_due' ? 'plată restantă' : null,
                      u.agentAdminDisabled ? 'agent blocat admin' : null,
                      u.agentActive && u.sessionStatus !== 'connected' ? 'agent activ fără WhatsApp' : null,
                      (u.subscriptionStatus === 'active' || u.subscriptionStatus === 'trialing') && u.sessionStatus !== 'connected' ? 'client fără WhatsApp conectat' : null,
                      u.subscriptionStatus === 'trialing' && u.trialEndsAt && u.trialEndsAt - Date.now() <= 2 * 86_400_000 ? 'trial expiră curând' : null,
                    ].filter(Boolean).join(' · ')
                    return (
                      <button key={u.id} onClick={() => setModal({ type: 'details', user: u })} className="w-full flex items-center justify-between gap-4 px-5 py-3 text-left hover:bg-cardhi transition-colors">
                        <div className="min-w-0">
                          <p className="font-mono-ui text-xs font-semibold text-ink truncate">{u.name}</p>
                          <p className="font-mono-ui text-[10px] text-dimmer truncate">{u.email}</p>
                        </div>
                        <p className="font-mono-ui text-[10px] text-orange-600 dark:text-orange-400 shrink-0 max-w-[260px] truncate">{reasons}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="card-elevated rounded-xl p-5">
                <h2 className="font-mono-ui text-sm font-semibold text-ink mb-4">Control AI</h2>
                <div className="space-y-3 font-mono-ui text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-dim">Prompt global</span>
                    <span className={`px-2 py-0.5 rounded-full ${config.default_system_prompt ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-cardhi text-dimmer'}`}>
                      {config.default_system_prompt ? 'setat' : 'nesetat'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-dim">Prompturi user</span>
                    <span className="text-ink">{users.filter(u => u.agentSystemPrompt?.trim()).length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-dim">Knowledge base</span>
                    <span className="text-ink">{users.filter(u => u.agentKnowledgeBase?.trim()).length}</span>
                  </div>
                  <button onClick={() => setActiveTab('config')} className="w-full mt-2 px-3 py-2 rounded-lg border border-line text-dim hover:text-ink hover:bg-cardhi transition-colors">
                    Configurează reguli globale
                  </button>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="card-elevated rounded-xl p-5">
                <h2 className="font-mono-ui text-sm font-semibold text-ink mb-4">Sănătate WhatsApp / Agenți</h2>
                <div className="space-y-3">
                  {healthCards.map(({ icon: Icon, label, value, sub }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-cardhi flex items-center justify-center"><Icon className="h-4 w-4 text-acid" /></div>
                      <div className="flex-1 min-w-0"><p className="font-mono-ui text-xs text-ink">{label}</p><p className="font-mono-ui text-[10px] text-dimmer">{sub}</p></div>
                      <p className="font-display text-[24px] text-ink">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-elevated rounded-xl p-5">
                <h2 className="font-mono-ui text-sm font-semibold text-ink mb-4">Metrici produs</h2>
                <div className="space-y-3">
                  {productCards.map(({ icon: Icon, label, value, sub }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-cardhi flex items-center justify-center"><Icon className="h-4 w-4 text-acid" /></div>
                      <div className="flex-1 min-w-0"><p className="font-mono-ui text-xs text-ink">{label}</p><p className="font-mono-ui text-[10px] text-dimmer">{sub}</p></div>
                      <p className="font-display text-[24px] text-ink">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-elevated rounded-xl p-5">
                <h2 className="font-mono-ui text-sm font-semibold text-ink mb-4">Billing clar</h2>
                <div className="space-y-3">
                  {billingCards.map(({ icon: Icon, label, value, sub }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-cardhi flex items-center justify-center"><Icon className="h-4 w-4 text-acid" /></div>
                      <div className="flex-1 min-w-0"><p className="font-mono-ui text-xs text-ink">{label}</p><p className="font-mono-ui text-[10px] text-dimmer">{sub}</p></div>
                      <p className="font-display text-[24px] text-ink">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Tab: Useri ─── */}
        {activeTab === 'users' && (
          <div className="card-elevated rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cardhi border-b border-line">
                    {['User', 'Subscripție', 'WhatsApp', 'Agent', 'Înregistrat', 'Acțiuni'].map(h => (
                      <th key={h} className="px-5 py-3 text-left font-mono-ui text-[10px] text-dimmer uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.map(u => {
                    const daysLeft = trialDaysLeft(u.trialEndsAt)
                    return (
                      <tr key={u.id} className="hover:bg-cardhi/60 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-mono-ui text-xs font-semibold text-ink">{u.name}</p>
                          <p className="font-mono-ui text-[10px] text-dimmer mt-0.5">{u.email}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <SubBadge status={u.subscriptionStatus} />
                            {u.subscriptionPlan && (
                              <span className="font-mono-ui text-[10px] text-dimmer capitalize">{u.subscriptionPlan}</span>
                            )}
                          </div>
                          {u.subscriptionStatus === 'trialing' && daysLeft && (
                            <p className="font-mono-ui text-[10px] text-orange-500 dark:text-orange-400 mt-1">Trial: {daysLeft}</p>
                          )}
                          {u.subscriptionStatus === 'active' && u.currentPeriodEndsAt && (
                            <p className="font-mono-ui text-[10px] text-dimmer mt-1">Până: {formatDate(u.currentPeriodEndsAt)}</p>
                          )}
                          {u.cancelAtPeriodEnd && (
                            <p className="font-mono-ui text-[10px] text-orange-500 dark:text-orange-400 mt-1">Anulare la final: {formatDate(u.cancelAt)}</p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {u.sessionStatus === 'connected'
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono-ui bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"><CheckCircle className="h-3 w-3" />Conectat</span>
                            : u.sessionStatus === 'pairing'
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono-ui bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"><Clock className="h-3 w-3" />Pairing</span>
                              : <span className="font-mono-ui text-xs text-dimmer">—</span>
                          }
                          {u.sessionPhone && (
                            <p className="font-mono-ui text-[10px] text-dimmer mt-1 flex items-center gap-0.5">
                              <Phone className="h-3 w-3" />{u.sessionPhone}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {u.agentAdminDisabled
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono-ui bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"><XCircle className="h-3 w-3" />Blocat admin</span>
                            : u.agentActive
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono-ui bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"><CheckCircle className="h-3 w-3" />Activ</span>
                              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono-ui bg-cardhi text-dimmer"><XCircle className="h-3 w-3" />Inactiv</span>
                          }
                          {u.agentTimerMinutes && (
                            <p className="font-mono-ui text-[10px] text-dimmer mt-1">Timer: {u.agentTimerMinutes} min</p>
                          )}
                        </td>
                        <td className="px-5 py-4 font-mono-ui text-xs text-dim">{formatDate(u.createdAt)}</td>
                        <td className="px-5 py-4">
                          <ActionsDropdown user={u} token={token!} onModal={setModal} onDisconnect={disconnectWa} onToggle={toggleAgent} toggling={toggling} />
                        </td>
                      </tr>
                    )
                  })}
                  {users.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-16 text-center font-mono-ui text-xs text-dimmer">Niciun user înregistrat.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Tab: Activitate ─── */}
        {activeTab === 'activity' && (
          <div className="card-elevated rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-3">
              <div>
                <h2 className="font-mono-ui text-sm font-semibold text-ink">Feed activitate recentă</h2>
                <p className="font-mono-ui text-[10px] text-dimmer mt-0.5">Ultimele {notifications.length} evenimente</p>
              </div>
              <button
                onClick={deleteAllNotifications}
                disabled={notifications.length === 0 || deletingNotification === 'all'}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line font-mono-ui text-xs text-dim hover:text-red-600 dark:hover:text-red-400 hover:bg-cardhi disabled:opacity-50 transition-colors"
              >
                {deletingNotification === 'all' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Șterge toate
              </button>
            </div>
            <div className="divide-y divide-line">
              {notifications.length === 0 ? (
                <p className="font-mono-ui text-xs text-dimmer text-center py-12">Nicio activitate înregistrată.</p>
              ) : notifications.map(n => {
                const typeColors: Record<string, string> = {
                  new_user: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300',
                  payment_failed: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
                  subscription_canceled: 'bg-cardhi text-dimmer',
                  subscription_updated: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300',
                }
                const color = typeColors[n.type] ?? 'bg-cardhi text-dimmer'
                return (
                  <div key={n.id} className="flex items-start gap-4 px-6 py-4">
                    <span className={`mt-0.5 px-2 py-0.5 rounded-full font-mono-ui text-[10px] tracking-wide ${color} shrink-0`}>{n.type}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono-ui text-xs font-semibold text-ink">{n.title}</p>
                      <p className="font-mono-ui text-[11px] text-dim mt-0.5 whitespace-pre-wrap">{n.body}</p>
                    </div>
                    <p className="font-mono-ui text-[10px] text-dimmer shrink-0">{new Date(n.createdAt).toLocaleString('ro-RO')}</p>
                    <button
                      onClick={() => deleteNotification(n.id)}
                      disabled={deletingNotification === n.id || deletingNotification === 'all'}
                      className="p-1.5 -mt-1 rounded-lg text-dimmer hover:text-red-600 dark:hover:text-red-400 hover:bg-cardhi disabled:opacity-50 transition-colors shrink-0"
                      title="Șterge activitatea"
                    >
                      {deletingNotification === n.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── Tab: Configurare ─── */}
        {activeTab === 'config' && (
          <div className="space-y-4">
            <div className="card-elevated rounded-xl p-6">
              <h2 className="font-mono-ui text-sm font-semibold text-ink mb-1">System prompt global</h2>
              <p className="font-mono-ui text-[10px] text-dimmer mb-4">Reguli obligatorii aplicate tuturor agenților, înainte de promptul userului.</p>
              <textarea
                value={configPrompt}
                onChange={e => setConfigPrompt(e.target.value)}
                rows={10}
                className={`${inputCls} font-mono resize-none`}
                placeholder="Reguli globale pentru toți agenții..."
              />
              <div className="flex items-center justify-between mt-4">
                <p className="font-mono-ui text-[10px] text-dimmer">{configPrompt.length} caractere</p>
                <button
                  onClick={saveConfig}
                  disabled={configSaving || !configPrompt.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 font-mono-ui text-xs rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
                  style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
                >
                  {configSaving
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : configSaved
                      ? <CheckCircle className="h-3.5 w-3.5" />
                      : <Save className="h-3.5 w-3.5" />
                  }
                  {configSaved ? 'Salvat!' : 'Salvează'}
                </button>
              </div>
            </div>

            <div className="card-elevated rounded-xl p-6">
              <h2 className="font-mono-ui text-sm font-semibold text-ink mb-1">Variabile platformă</h2>
              <p className="font-mono-ui text-[10px] text-dimmer mb-4">Valorile curente din configurarea platformei.</p>
              <div className="space-y-2">
                {Object.entries(config).length === 0 ? (
                  <p className="font-mono-ui text-xs text-dimmer">Nicio configurare salvată.</p>
                ) : Object.entries(config).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-3 p-3 bg-cardhi rounded-lg">
                    <span className="font-mono text-xs font-medium text-acid mt-0.5 shrink-0">{key}</span>
                    <span className="font-mono-ui text-xs text-dim line-clamp-2">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
