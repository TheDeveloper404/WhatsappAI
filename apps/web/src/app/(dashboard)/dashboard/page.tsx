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
  if (!sub || sub.status === 'incomplete') return { text: 'Fără subscripție', color: 'bg-gray-100 text-gray-600' }
  const map: Record<string, { text: string; color: string }> = {
    trialing: { text: 'Trial activ', color: 'bg-purple-100 text-purple-700' },
    active: { text: 'Activ', color: 'bg-green-100 text-green-700' },
    past_due: { text: 'Plată eșuată', color: 'bg-red-100 text-red-700' },
    canceled: { text: 'Anulat', color: 'bg-gray-100 text-gray-500' },
  }
  return map[sub.status] ?? { text: sub.status, color: 'bg-gray-100 text-gray-600' }
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
          <h1 className="text-2xl font-bold text-gray-900">
            Bună, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 mt-1">Dashboard-ul agentului tău AI</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${statusColor}`}>
            {statusText}
          </span>
          {sub && sub.status !== 'incomplete' && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handlePortal}
                disabled={loadingPortal}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                {loadingPortal ? 'Se încarcă…' : 'Gestionează subscripția'} <ExternalLink className="h-3.5 w-3.5" />
              </button>
              {portalError && (
                <p className="text-xs text-red-500">Nu e disponibil momentan. Contactează suportul.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Banners */}
      {checkoutSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">
            <strong>Plată procesată!</strong> Trial-ul de 7 zile a început. Agentul va fi activat în curând de echipa noastră.
          </p>
        </div>
      )}

      {aiSettings?.adminDisabled && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <p className="text-sm text-orange-800">
            <strong>Agentul a fost dezactivat de administrator.</strong> Contactează suportul pentru detalii și reactivare.
          </p>
        </div>
      )}

      {sub?.status === 'past_due' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <p className="text-sm text-red-800">
            <strong>Plată eșuată.</strong> Agentul a fost dezactivat. Actualizează metoda de plată pentru a reactiva.
          </p>
          <button onClick={handlePortal} className="ml-auto text-sm font-semibold text-red-700 underline whitespace-nowrap">
            Actualizează plata
          </button>
        </div>
      )}

      {!checkoutSuccess && (!sub || sub.status === 'incomplete') && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>Pasul următor:</strong> Agentul tău nu este încă activ. Echipa noastră îl va activa în curând după ce verificăm contul tău.
          </p>
        </div>
      )}

      {/* AI Toggle Card + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* AI Toggle — prominent */}
        <div className={`bg-white rounded-xl border-2 p-5 flex flex-col gap-3 transition-colors ${
          aiSettings?.adminDisabled ? 'border-orange-200' :
          aiSettings?.isActive ? 'border-primary-300' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                aiSettings?.adminDisabled ? 'bg-orange-50 text-orange-500' :
                aiSettings?.isActive ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 text-gray-400'
              }`}>
                <Bot className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-gray-700">Agent AI</span>
            </div>
            <button
              onClick={handleToggleAI}
              disabled={togglingAI || !canToggleAI}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                aiSettings?.isActive ? 'bg-primary-600' : 'bg-gray-200'
              }`}
              title={aiSettings?.adminDisabled ? 'Dezactivat de administrator' : undefined}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                aiSettings?.isActive ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          <div>
            <p className={`text-lg font-bold ${
              aiSettings?.adminDisabled ? 'text-orange-600' :
              aiSettings?.isActive ? 'text-primary-600' : 'text-gray-400'
            }`}>
              {aiSettings?.adminDisabled ? 'Blocat' : aiSettings?.isActive ? 'Activ' : 'Inactiv'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
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
              className="text-xs text-primary-600 hover:underline flex items-center gap-1 mt-auto"
            >
              <Settings className="h-3 w-3" /> Configurează setările
            </button>
          )}
        </div>

        {/* WhatsApp */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              waSession?.status === 'connected' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
            }`}>
              <Wifi className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-gray-700">WhatsApp</span>
          </div>
          <div>
            <p className={`text-lg font-bold ${
              waSession?.status === 'connected' ? 'text-green-600' : 'text-gray-400'
            }`}>
              {waSession?.status === 'connected' ? 'Conectat' : waSession?.status === 'pairing' ? 'Asociere…' : 'Neconectat'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {waSession?.phoneNumber ? `+${waSession.phoneNumber}` : 'Niciun număr asociat'}
            </p>
          </div>
          {waSession?.status !== 'connected' && (
            <button
              onClick={() => router.push('/connect')}
              className="text-xs text-primary-600 hover:underline mt-auto"
            >
              Conectează acum →
            </button>
          )}
        </div>

        {/* Trial / Subscripție */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-50 text-purple-600">
              <Clock className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-gray-700">Trial</span>
          </div>
          <div>
            <p className="text-lg font-bold text-purple-600">
              {sub?.status === 'trialing' ? trialDaysLeft(sub.trialEndsAt) : sub?.status === 'active' ? '—' : '7 zile'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {sub?.status === 'trialing' ? 'rămase din trial' : sub?.status === 'active' ? 'subscripție activă' : 'trial disponibil'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-auto">
            <MessageSquare className="h-3 w-3 text-gray-300" />
            <span className="text-xs text-gray-400">Mesaje procesate: —</span>
          </div>
        </div>
      </div>

      {/* Onboarding Steps */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Pașii următori</h2>
        <div className="flex flex-col gap-4">
          {[
            { step: 1, title: 'Cont creat', done: true, desc: 'Contul tău este activ.' },
            {
              step: 2,
              title: 'Subscripție activată',
              done: !!sub && sub.status !== 'incomplete',
              desc: sub?.status === 'trialing' ? `Trial activ — ${trialDaysLeft(sub.trialEndsAt)} rămase.` : 'Alege un plan pentru a activa agentul.',
            },
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
                ? '⚠️ Agentul a fost dezactivat de administrator. Contactează suportul.'
                : aiSettings?.isActive
                  ? 'Agentul AI preia conversațiile când ești indisponibil.'
                  : 'Activează agentul din cardul de mai sus sau din Setări.',
              action: canToggleAI && !aiSettings?.isActive ? handleToggleAI : undefined,
              actionLabel: 'Activează acum',
            },
          ].map(({ step, title, done, desc, action, actionLabel }: { step: number; title: string; done: boolean; desc: string; action?: () => void; actionLabel?: string }) => (
            <div key={step} className="flex gap-4">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5 ${done ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {done ? '✓' : step}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${done ? 'text-gray-900' : 'text-gray-500'}`}>{title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                {action && !done && (
                  <button onClick={action} className="text-xs text-primary-600 hover:underline mt-1 font-medium">
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
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
