'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { api, type Subscription, type WhatsappSession, type AiSettings } from '@/lib/api'
import { Bot, Wifi, Clock, MessageSquare, CheckCircle2, ExternalLink, Settings, Loader2 } from 'lucide-react'

function trialDaysLeft(trialEndsAt: number | null): string {
  if (!trialEndsAt) return '—'
  const ms = trialEndsAt - Date.now()
  if (ms <= 0) return 'Expirat'
  return `${Math.ceil(ms / 86_400_000)} zile`
}

function statusLabel(sub: Subscription | null): { text: string; color: string } {
  if (!sub || sub.status === 'incomplete') return { text: 'Fără subscripție', color: 'bg-cardhi text-dim' }
  const map: Record<string, { text: string; color: string }> = {
    trialing: { text: 'Trial activ', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
    active: { text: 'Activ', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
    past_due: { text: 'Plată eșuată', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
    canceled: { text: 'Anulat', color: 'bg-cardhi text-dim' },
  }
  return map[sub.status] ?? { text: sub.status, color: 'bg-cardhi text-dim' }
}

function DashboardContent() {
  const user = useAuthStore(s => s.user)
  const accessToken = useAuthStore(s => s.accessToken)
  const searchParams = useSearchParams()
  const router = useRouter()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [waSession, setWaSession] = useState<WhatsappSession | null>(null)
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [portalError, setPortalError] = useState(false)
  const [togglingAI, setTogglingAI] = useState(false)
  const checkoutSuccess = searchParams.get('checkout') === 'success'

  useEffect(() => {
    if (!accessToken) return
    api.billing.getSubscription(accessToken).then(({ subscription }) => setSub(subscription))
    api.whatsapp.getSession(accessToken).then(({ session }) => setWaSession(session)).catch(() => {})
    api.ai.getSettings(accessToken).then(({ settings }) => setAiSettings(settings)).catch(() => {})
  }, [accessToken])

  async function handlePortal() {
    if (!accessToken) return
    setLoadingPortal(true)
    setPortalError(false)
    try {
      const { url } = await api.billing.createPortal(accessToken)
      window.location.href = url
    } catch {
      setLoadingPortal(false)
      setPortalError(true)
    }
  }

  async function handleToggleAI() {
    if (!accessToken || !aiSettings || aiSettings.adminDisabled) return
    setTogglingAI(true)
    try {
      const { settings } = await api.ai.updateSettings(accessToken, { isActive: !aiSettings.isActive })
      setAiSettings(settings)
    } finally {
      setTogglingAI(false)
    }
  }

  const { text: statusText, color: statusColor } = statusLabel(sub)
  const canToggleAI = aiSettings && !aiSettings.adminDisabled

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-[32px] text-ink leading-none">
            Bună, {user?.name?.split(' ')[0]}
          </h1>
          <p className="font-mono-ui text-[12px] text-dim mt-1">Dashboard-ul agentului tău AI</p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role !== 'admin' && (
          <span className={`font-mono-ui text-[10px] tracking-wide px-3 py-1.5 rounded-full ${statusColor}`}>
            {statusText}
          </span>
          )}
          {sub && sub.status !== 'incomplete' && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handlePortal}
                disabled={loadingPortal}
                className="font-mono-ui text-[12px] text-dim hover:text-ink flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                {loadingPortal ? 'Se încarcă…' : 'Gestionează subscripția'} <ExternalLink className="h-3.5 w-3.5" />
              </button>
              {portalError && (
                <p className="font-mono-ui text-[11px] text-red-500 dark:text-red-400">Nu e disponibil momentan. Contactează suportul.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Banners */}
      {checkoutSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="font-mono-ui text-[12px] text-green-800 dark:text-green-300">
            <strong>Plată procesată!</strong> Trial-ul de 7 zile a început. Agentul va fi activat în curând de echipa noastră.
          </p>
        </div>
      )}

      {aiSettings?.adminDisabled && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-6 flex items-center gap-3">
          <p className="font-mono-ui text-[12px] text-orange-800 dark:text-orange-300">
            <strong>Agentul a fost dezactivat de administrator.</strong> Contactează suportul pentru detalii și reactivare.
          </p>
        </div>
      )}

      {sub?.status === 'past_due' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 flex items-center gap-3">
          <p className="font-mono-ui text-[12px] text-red-800 dark:text-red-300">
            <strong>Plată eșuată.</strong> Agentul a fost dezactivat. Actualizează metoda de plată pentru a reactiva.
          </p>
          <button onClick={handlePortal} className="ml-auto font-mono-ui text-[12px] font-medium text-red-700 dark:text-red-400 underline whitespace-nowrap">
            Actualizează plata
          </button>
        </div>
      )}

      {!checkoutSuccess && (!sub || sub.status === 'incomplete') && user?.role !== 'admin' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-8 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <p className="font-mono-ui text-[12px] text-amber-800 dark:text-amber-300">
            <strong>Pasul următor:</strong> Agentul tău nu este încă activ. Echipa noastră îl va activa în curând după ce verificăm contul tău.
          </p>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* AI Toggle */}
        <div className={`rounded-xl border-2 p-5 flex flex-col gap-3 transition-colors bg-card ${
          aiSettings?.adminDisabled ? 'border-orange-400 dark:border-orange-600' :
          aiSettings?.isActive ? 'border-acid' : 'border-line'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                aiSettings?.adminDisabled ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-500' :
                aiSettings?.isActive ? 'bg-acid/10 text-acid' : 'bg-cardhi text-dimmer'
              }`}>
                <Bot className="h-4 w-4" />
              </div>
              <span className="font-mono-ui text-[12px] text-dim">Agent AI</span>
            </div>
            <button
              onClick={handleToggleAI}
              disabled={togglingAI || !canToggleAI}
              style={aiSettings?.isActive ? { background: 'var(--acid)' } : undefined}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                aiSettings?.isActive ? '' : 'bg-cardhi border border-line'
              }`}
              title={aiSettings?.adminDisabled ? 'Dezactivat de administrator' : undefined}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                aiSettings?.isActive ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          <div>
            <p className={`font-display text-[20px] leading-none ${
              aiSettings?.adminDisabled ? 'text-orange-600 dark:text-orange-400' :
              aiSettings?.isActive ? 'text-acid' : 'text-dimmer'
            }`}>
              {aiSettings?.adminDisabled ? 'Blocat' : aiSettings?.isActive ? 'Activ' : 'Inactiv'}
            </p>
            <p className="font-mono-ui text-[11px] text-dimmer mt-1">
              {aiSettings?.adminDisabled
                ? 'Contactează suportul'
                : aiSettings?.isActive
                  ? `Timer: ${aiSettings.timerMinutes} min inactivitate`
                  : 'Apasă toggle pentru a activa'}
            </p>
          </div>
          {canToggleAI && (
            <button
              onClick={() => router.push('/settings')}
              className="font-mono-ui text-[11px] text-acid hover:underline flex items-center gap-1 mt-auto"
            >
              <Settings className="h-3 w-3" /> Configurează setările
            </button>
          )}
        </div>

        {/* WhatsApp */}
        <div className="card-elevated rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              waSession?.status === 'connected'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'bg-cardhi text-dimmer'
            }`}>
              <Wifi className="h-4 w-4" />
            </div>
            <span className="font-mono-ui text-[12px] text-dim">WhatsApp</span>
          </div>
          <div>
            <p className={`font-display text-[20px] leading-none ${
              waSession?.status === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-dimmer'
            }`}>
              {waSession?.status === 'connected' ? 'Conectat' : waSession?.status === 'pairing' ? 'Asociere…' : 'Neconectat'}
            </p>
            <p className="font-mono-ui text-[11px] text-dimmer mt-1">
              {waSession?.phoneNumber ? `+${waSession.phoneNumber}` : 'Niciun număr asociat'}
            </p>
          </div>
          {waSession?.status !== 'connected' && (
            <button
              onClick={() => router.push('/connect')}
              className="font-mono-ui text-[11px] text-acid hover:underline mt-auto"
            >
              Conectează acum →
            </button>
          )}
        </div>

        {/* Trial — ascuns pentru admin */}
        {user?.role !== 'admin' && (
        <div className="card-elevated rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <Clock className="h-4 w-4" />
            </div>
            <span className="font-mono-ui text-[12px] text-dim">Trial</span>
          </div>
          <div>
            <p className="font-display text-[20px] leading-none text-purple-600 dark:text-purple-400">
              {sub?.status === 'trialing' ? trialDaysLeft(sub.trialEndsAt) : sub?.status === 'active' ? '—' : '7 zile'}
            </p>
            <p className="font-mono-ui text-[11px] text-dimmer mt-1">
              {sub?.status === 'trialing' ? 'rămase din trial' : sub?.status === 'active' ? 'subscripție activă' : 'trial disponibil'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-auto">
            <MessageSquare className="h-3 w-3 text-dimmer" />
            <span className="font-mono-ui text-[11px] text-dimmer">Mesaje procesate: —</span>
          </div>
        </div>
        )}
      </div>

      {/* Onboarding Steps */}
      <div className="card-elevated rounded-xl p-6">
        <h2 className="font-mono-ui text-[10px] text-dimmer tracking-widest uppercase mb-5">Pașii următori</h2>
        <div className="flex flex-col gap-4">
          {[
            { step: 1, title: 'Cont creat', done: true, desc: 'Contul tău este activ.' },
            ...(user?.role !== 'admin' ? [{
              step: 2,
              title: 'Subscripție activată',
              done: !!sub && sub.status !== 'incomplete',
              desc: sub?.status === 'trialing' ? `Trial activ — ${trialDaysLeft(sub.trialEndsAt)} rămase.` : 'Alege un plan pentru a activa agentul.',
            }] : []),
            {
              step: 3,
              title: 'Conectare WhatsApp',
              done: waSession?.status === 'connected',
              desc: waSession?.status === 'connected'
                ? `Conectat: +${waSession.phoneNumber}`
                : waSession?.status === 'pairing'
                  ? 'Asociere în curs…'
                  : 'Introdu numărul tău și obține codul de asociere.',
              action: waSession?.status !== 'connected' ? () => router.push('/connect') : undefined,
            },
            {
              step: 4,
              title: 'Agent live',
              done: aiSettings?.isActive === true,
              desc: aiSettings?.adminDisabled
                ? 'Agentul a fost dezactivat de administrator. Contactează suportul.'
                : aiSettings?.isActive
                  ? 'Agentul AI preia conversațiile când ești indisponibil.'
                  : 'Activează agentul din cardul de mai sus sau din Setări.',
              action: canToggleAI && !aiSettings?.isActive ? handleToggleAI : undefined,
              actionLabel: 'Activează acum',
            },
          ].map(({ step, title, done, desc, action, actionLabel }: { step: number; title: string; done: boolean; desc: string; action?: () => void; actionLabel?: string }) => (
            <div key={step} className="flex gap-4">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-mono-ui text-[11px] font-medium shrink-0 mt-0.5 ${done ? '' : 'bg-cardhi text-dimmer'}`}
                style={done ? { background: 'var(--acid)', color: 'var(--on-acid)' } : undefined}
              >
                {done ? '✓' : step}
              </div>
              <div className="flex-1">
                <p className={`font-mono-ui text-[12px] font-medium ${done ? 'text-ink' : 'text-dim'}`}>{title}</p>
                <p className="font-mono-ui text-[11px] text-dimmer mt-0.5">{desc}</p>
                {action && !done && (
                  <button onClick={action} className="font-mono-ui text-[11px] text-acid hover:underline mt-1 font-medium">
                    {actionLabel ?? 'Conectează acum'} →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-acid" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
