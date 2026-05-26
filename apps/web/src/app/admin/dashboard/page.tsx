'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Users, Bot, CreditCard, RefreshCw, Bell, LogOut, Phone,
  CheckCircle, XCircle, Clock, AlertCircle, TrendingUp, ChevronDown,
  Mail, Trash2, WifiOff, CalendarPlus, Settings, Save, X,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface AdminUser {
  id: string; name: string; email: string; createdAt: number
  subscriptionStatus: string | null; subscriptionPlan: string | null
  trialEndsAt: number | null; currentPeriodEndsAt: number | null
  sessionStatus: string | null; sessionPhone: string | null
  agentActive: boolean | null; agentAdminDisabled: boolean | null
  agentTimerMinutes: number | null; agentSystemPrompt: string | null
}

interface AdminStats {
  totalUsers: number; activeSubscribers: number; inTrial: number
  pastDue: number; activeAgents: number; mrr: number
  conversionRate: number; newThisMonth: number
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
  trialing:   { label: 'Trial',     color: 'bg-blue-100 text-blue-700',    icon: Clock },
  active:     { label: 'Activ',     color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  past_due:   { label: 'Restanță',  color: 'bg-red-100 text-red-700',      icon: AlertCircle },
  canceled:   { label: 'Anulat',    color: 'bg-gray-100 text-gray-600',    icon: XCircle },
  incomplete: { label: 'Incomplet', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
}

function SubBadge({ status }: { status: string | null }) {
  const cfg = SUB_CONFIG[status ?? ''] ?? { label: '—', color: 'bg-gray-100 text-gray-400', icon: XCircle }
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

// ─── Modal email ────────────────────────────────────────────────────────────
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Trimite email — {user.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="text-xs text-gray-400">Către: {user.email}</p>
          <input
            placeholder="Subiect"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <textarea
            placeholder="Mesaj..."
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={5}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Anulează</button>
          <button
            onClick={send}
            disabled={loading || done || !subject.trim() || !body.trim()}
            className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <CheckCircle className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
            {done ? 'Trimis!' : 'Trimite'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal extindere trial ───────────────────────────────────────────────────
function TrialModal({ user, token, onClose, onDone }: { user: AdminUser; token: string; onClose: () => void; onDone: () => void }) {
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(false)

  async function extend() {
    setLoading(true)
    try {
      await adminFetch(`/users/${user.id}/extend-trial`, token, { method: 'POST', body: JSON.stringify({ days }) })
      onDone()
      onClose()
    } catch {}
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Extinde trial — {user.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5">
          <label className="text-sm text-gray-600 block mb-2">Număr de zile de adăugat</label>
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {user.trialEndsAt && (
            <p className="text-xs text-gray-400 mt-2">
              Expiră acum: {formatDate(user.trialEndsAt)}
              {' → '}
              {formatDate(Math.max(user.trialEndsAt, Date.now()) + days * 86_400_000)}
            </p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Anulează</button>
          <button
            onClick={extend}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Extinde
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal ștergere cont ─────────────────────────────────────────────────────
function DeleteModal({ user, token, onClose, onDone }: { user: AdminUser; token: string; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false)

  async function doDelete() {
    setLoading(true)
    try {
      await adminFetch(`/users/${user.id}`, token, { method: 'DELETE' })
      onDone()
      onClose()
    } catch {}
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-5">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">Șterge contul lui {user.name}?</h3>
          <p className="text-sm text-gray-500 mt-1">Această acțiune este ireversibilă. Toate datele (subscripție, sesiune WA, mesaje) vor fi șterse.</p>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Anulează</button>
          <button
            onClick={doDelete}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Șterge definitiv
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Dropdown acțiuni per user ───────────────────────────────────────────────
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
      {/* Toggle agent */}
      <button
        onClick={() => onToggle(user.id, user.agentActive)}
        disabled={toggling === user.id}
        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
          user.agentActive
            ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100'
            : user.agentAdminDisabled
              ? 'border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100'
              : 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
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

      {/* More actions */}
      <div className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className="inline-flex items-center gap-0.5 text-xs font-medium px-2 py-1.5 rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {open && (
          <div className="absolute right-0 top-8 w-44 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
            <button
              onClick={() => act(() => onModal({ type: 'trial', user }))}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <CalendarPlus className="h-3.5 w-3.5 text-blue-500" />Extinde trial
            </button>
            <button
              onClick={() => act(() => onModal({ type: 'email', user }))}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Mail className="h-3.5 w-3.5 text-primary-500" />Trimite email
            </button>
            {user.sessionStatus === 'connected' && (
              <button
                onClick={() => act(() => onDisconnect(user.id))}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <WifiOff className="h-3.5 w-3.5 text-yellow-500" />Deconectează WA
              </button>
            )}
            <div className="border-t border-gray-100" />
            <button
              onClick={() => act(() => onModal({ type: 'delete', user }))}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />Șterge cont
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard principal ─────────────────────────────────────────────────────
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
  const [modal, setModal] = useState<ModalState>(null)
  const [activeTab, setActiveTab] = useState<'users' | 'activity' | 'config'>('users')

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
  }, [loadAll])

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

  function logout() { sessionStorage.removeItem('admin_token'); router.replace('/admin') }

  const statCards = stats ? [
    { icon: Users,       label: 'Total useri',     value: stats.totalUsers,          sub: `+${stats.newThisMonth} luna aceasta`, color: 'text-blue-600 bg-blue-50' },
    { icon: CreditCard,  label: 'Abonați activi',  value: stats.activeSubscribers,   sub: `${stats.conversionRate}% conversie`,   color: 'text-green-600 bg-green-50' },
    { icon: Clock,       label: 'În trial',         value: stats.inTrial,            sub: stats.pastDue > 0 ? `${stats.pastDue} cu restanță` : null, color: 'text-yellow-600 bg-yellow-50' },
    { icon: Bot,         label: 'Agenți activi',   value: stats.activeAgents,        sub: null,                                   color: 'text-primary-600 bg-primary-50' },
    { icon: TrendingUp,  label: 'MRR estimat',     value: `${stats.mrr.toFixed(0)} RON`, sub: 'echivalent lunar',                color: 'text-purple-600 bg-purple-50' },
  ] : []

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modals */}
      {modal?.type === 'email' && (
        <EmailModal user={modal.user} token={token!} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'trial' && (
        <TrialModal user={modal.user} token={token!} onClose={() => setModal(null)} onDone={() => token && loadAll(token, true)} />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal user={modal.user} token={token!} onClose={() => setModal(null)}
          onDone={() => setUsers(prev => prev.filter(u => u.id !== modal.user.id))}
        />
      )}

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20.52 3.48A11.93 11.93 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.1 1.51 5.82L0 24l6.34-1.66A11.93 11.93 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52z" fill="white"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">WhatsApp AI</p>
            <p className="text-xs text-gray-400">Admin Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => token && loadAll(token, true)} disabled={refreshing}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Reîncarcă">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative">
            <button onClick={openBell} className="relative p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-3.5 w-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 top-11 w-80 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">Notificări</p>
                  {unreadCount === 0 && <span className="text-xs text-gray-400">Toate citite</span>}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {notifications.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-8">Nicio notificare</p>
                    : notifications.map(n => (
                      <div key={n.id} className={`px-4 py-3 ${!n.readAt ? 'bg-blue-50 border-l-2 border-blue-400' : ''}`}>
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{n.body}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString('ro-RO')}</p>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors">
            <LogOut className="h-4 w-4" />Ieși
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} useri înregistrați</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {statCards.map(({ icon: Icon, label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-3`}>
                <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{label}</p>
              {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {([['users', 'Useri', Users], ['activity', 'Activitate', Bell], ['config', 'Configurare', Settings]] as const).map(([tab, label, Icon]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        {/* ─── Tab: Useri ─── */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Subscripție</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">WhatsApp</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Agent</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Înregistrat</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Acțiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(u => {
                    const daysLeft = trialDaysLeft(u.trialEndsAt)
                    return (
                      <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <SubBadge status={u.subscriptionStatus} />
                            {u.subscriptionPlan && (
                              <span className="text-xs text-gray-400 capitalize">{u.subscriptionPlan}</span>
                            )}
                          </div>
                          {u.subscriptionStatus === 'trialing' && daysLeft && (
                            <p className="text-xs text-orange-500 mt-1">Trial: {daysLeft}</p>
                          )}
                          {u.subscriptionStatus === 'active' && u.currentPeriodEndsAt && (
                            <p className="text-xs text-gray-400 mt-1">Până: {formatDate(u.currentPeriodEndsAt)}</p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {u.sessionStatus === 'connected'
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="h-3 w-3" />Conectat</span>
                            : u.sessionStatus === 'pairing'
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock className="h-3 w-3" />Pairing</span>
                              : <span className="text-xs text-gray-400">—</span>
                          }
                          {u.sessionPhone && (
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-0.5">
                              <Phone className="h-3 w-3" />{u.sessionPhone}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {u.agentAdminDisabled
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700"><XCircle className="h-3 w-3" />Blocat admin</span>
                            : u.agentActive
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="h-3 w-3" />Activ</span>
                              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500"><XCircle className="h-3 w-3" />Inactiv</span>
                          }
                          {u.agentTimerMinutes && (
                            <p className="text-xs text-gray-400 mt-1">Timer: {u.agentTimerMinutes} min</p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-500">{formatDate(u.createdAt)}</td>
                        <td className="px-5 py-4">
                          <ActionsDropdown
                            user={u}
                            token={token!}
                            onModal={setModal}
                            onDisconnect={disconnectWa}
                            onToggle={toggleAgent}
                            toggling={toggling}
                          />
                        </td>
                      </tr>
                    )
                  })}
                  {users.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-16 text-center text-sm text-gray-400">Niciun user înregistrat.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Tab: Activitate ─── */}
        {activeTab === 'activity' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Feed activitate recentă</h2>
              <p className="text-xs text-gray-400 mt-0.5">Ultimele {notifications.length} evenimente</p>
            </div>
            <div className="divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">Nicio activitate înregistrată.</p>
              ) : notifications.map(n => {
                const typeColors: Record<string, string> = {
                  new_user: 'bg-blue-100 text-blue-600',
                  payment_failed: 'bg-red-100 text-red-600',
                  subscription_canceled: 'bg-gray-100 text-gray-600',
                  subscription_updated: 'bg-yellow-100 text-yellow-600',
                }
                const color = typeColors[n.type] ?? 'bg-gray-100 text-gray-500'
                return (
                  <div key={n.id} className="flex items-start gap-4 px-6 py-4">
                    <span className={`mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${color} shrink-0`}>{n.type}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{n.body}</p>
                    </div>
                    <p className="text-xs text-gray-400 shrink-0">{new Date(n.createdAt).toLocaleString('ro-RO')}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── Tab: Configurare ─── */}
        {activeTab === 'config' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1">System prompt implicit</h2>
              <p className="text-xs text-gray-400 mb-4">Folosit pentru useri noi care nu și-au setat propriul prompt.</p>
              <textarea
                value={configPrompt}
                onChange={e => setConfigPrompt(e.target.value)}
                rows={10}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="System prompt implicit pentru toți userii noi..."
              />
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-gray-400">{configPrompt.length} caractere</p>
                <button
                  onClick={saveConfig}
                  disabled={configSaving || !configPrompt.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
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

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Variabile platformă</h2>
              <p className="text-xs text-gray-400 mb-4">Valorile curente din configurarea platformei.</p>
              <div className="space-y-2">
                {Object.entries(config).length === 0 ? (
                  <p className="text-sm text-gray-400">Nicio configurare salvată.</p>
                ) : Object.entries(config).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xs font-mono font-medium text-gray-600 mt-0.5 shrink-0">{key}</span>
                    <span className="text-xs text-gray-500 line-clamp-2">{value}</span>
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
