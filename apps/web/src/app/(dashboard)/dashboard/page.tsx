'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { api, type Subscription, type WhatsappSession, type AiSettings, type AiStats, type AiAdvancedStats } from '@/lib/api'
import { QRCodeSVG } from 'qrcode.react'
import {
  Bot, Wifi, WifiOff, Clock, MessageSquare, CheckCircle2, ExternalLink,
  Settings, Loader2, Smartphone, RefreshCw, X,
} from 'lucide-react'

function trialDaysLeft(trialEndsAt: number | null): string {
  if (!trialEndsAt) return '—'
  const ms = trialEndsAt - Date.now()
  if (ms <= 0) return 'Expirat'
  return `${Math.ceil(ms / 86_400_000)} zile`
}

function formatDate(ts: number | null): string {
  if (!ts) return 'data finală'
  return new Date(ts).toLocaleDateString('ro-RO')
}

function subscriptionEndsAt(sub: Subscription | null): number | null {
  if (!sub) return null
  return sub.cancelAt ?? (sub.status === 'trialing' ? sub.trialEndsAt : sub.currentPeriodEndsAt)
}

function statusLabel(sub: Subscription | null): { text: string; color: string } {
  if (!sub || sub.status === 'incomplete') return { text: 'Fără subscripție', color: 'bg-cardhi text-dim' }
  if (sub.cancelAtPeriodEnd) return { text: 'Anulat la final', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' }
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
  const [stats, setStats] = useState<AiStats | null>(null)
  const [advStats, setAdvStats] = useState<AiAdvancedStats | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [portalError, setPortalError] = useState(false)
  const [togglingAI, setTogglingAI] = useState(false)
  const [initialLoaded, setInitialLoaded] = useState(false)

  // WhatsApp connect panel
  const [showWaPanel, setShowWaPanel] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [waConnecting, setWaConnecting] = useState(false)
  const [waDisconnecting, setWaDisconnecting] = useState(false)
  const [waError, setWaError] = useState('')
  const waPollRef = useRef<ReturnType<typeof setInterval>>()

  const checkoutSuccess = searchParams.get('checkout') === 'success'
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false)
  const [showTrialPopup, setShowTrialPopup] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    Promise.all([
      api.billing.getSubscription(accessToken).then(({ subscription }) => setSub(subscription)).catch(() => {}),
      api.whatsapp.getSession(accessToken).then(({ session }) => setWaSession(session)).catch(() => {}),
      api.ai.getSettings(accessToken).then(({ settings }) => setAiSettings(settings)).catch(() => {}),
      api.ai.getStats(accessToken).then(({ stats }) => setStats(stats)).catch(() => {}),
      api.ai.getAdvancedStats(accessToken).then(({ stats }) => setAdvStats(stats)).catch(() => {}),
    ]).finally(() => setInitialLoaded(true))
  }, [accessToken])

  useEffect(() => {
    if (!checkoutSuccess) return
    setShowCheckoutSuccess(true)
    router.replace('/dashboard', { scroll: false })
  }, [checkoutSuccess, router])

  // Popup expirare trial: apare la ≤3 zile rămase, o singură dată pe zi (per browser).
  useEffect(() => {
    if (!sub || sub.status !== 'trialing' || !sub.trialEndsAt || sub.cancelAtPeriodEnd) return
    const msLeft = sub.trialEndsAt - Date.now()
    const daysLeft = Math.ceil(msLeft / 86_400_000)
    if (msLeft <= 0 || daysLeft > 3) return
    const todayKey = `wa-ai-trial-popup-${new Date().toISOString().slice(0, 10)}`
    if (localStorage.getItem(todayKey)) return
    setShowTrialPopup(true)
  }, [sub])

  function dismissTrialPopup() {
    const todayKey = `wa-ai-trial-popup-${new Date().toISOString().slice(0, 10)}`
    localStorage.setItem(todayKey, '1')
    setShowTrialPopup(false)
  }

  useEffect(() => {
    if (!accessToken || !showWaPanel) return
    clearInterval(waPollRef.current)
    const poll = async () => {
      try {
        const { session } = await api.whatsapp.getSession(accessToken)
        setWaSession(session)
        if (session?.status === 'pairing' && session.pairingCode) setQrCode(session.pairingCode)
        if (session?.status === 'connected') {
          clearInterval(waPollRef.current)
          setShowWaPanel(false)
          setQrCode(null)
        }
      } catch {}
    }
    waPollRef.current = setInterval(poll, 3000)
    return () => clearInterval(waPollRef.current)
  }, [accessToken, showWaPanel])

  async function handlePortal() {
    if (!accessToken) return
    setLoadingPortal(true); setPortalError(false)
    try {
      const { url } = await api.billing.createPortal(accessToken)
      window.location.href = url
    } catch { setLoadingPortal(false); setPortalError(true) }
  }

  async function handleToggleAI() {
    if (!accessToken || !aiSettings || aiSettings.adminDisabled) return
    setTogglingAI(true)
    try {
      const { settings } = await api.ai.updateSettings(accessToken, { isActive: !aiSettings.isActive })
      setAiSettings(settings)
    } finally { setTogglingAI(false) }
  }

  async function handleWaConnect() {
    if (!accessToken) return
    setWaError(''); setWaConnecting(true); setQrCode(null)
    try {
      const { qrCode: code } = await api.whatsapp.connect(accessToken)
      setQrCode(code)
    } catch (err: unknown) {
      setWaError((err as { message?: string })?.message ?? 'Eroare la conectare.')
    } finally { setWaConnecting(false) }
  }

  async function handleWaDisconnect() {
    if (!accessToken) return
    setWaDisconnecting(true); setWaError('')
    try {
      await api.whatsapp.disconnect(accessToken)
      setWaSession(null); setQrCode(null); setShowWaPanel(false)
    } catch (err: unknown) {
      setWaError((err as { message?: string })?.message ?? 'Eroare la deconectare.')
    } finally { setWaDisconnecting(false) }
  }

  const isWaConnected = waSession?.status === 'connected'
  const { text: statusText, color: statusColor } = statusLabel(sub)
  const canToggleAI = aiSettings && !aiSettings.adminDisabled
  const subEndsAt = subscriptionEndsAt(sub)
  const subEndsDate = formatDate(subEndsAt)
  const subscriptionStep = (() => {
    if (!sub || sub.status === 'incomplete') {
      return {
        title: 'Subscripție neactivată',
        done: false,
        desc: 'Alege un plan pentru a activa agentul.',
      }
    }

    if (sub.status === 'past_due') {
      return {
        title: 'Plată eșuată',
        done: false,
        desc: 'Actualizează metoda de plată pentru a reactiva abonamentul.',
      }
    }

    if (sub.status === 'canceled') {
      return {
        title: 'Subscripție anulată',
        done: false,
        desc: 'Abonamentul este anulat. Alege un plan nou pentru a reactiva agentul.',
      }
    }

    if (sub.cancelAtPeriodEnd) {
      return {
        title: 'Subscripție anulată',
        done: false,
        desc: sub.status === 'trialing'
          ? `Trialul rămâne activ până la ${subEndsDate} (${trialDaysLeft(sub.trialEndsAt)} rămase).`
          : `Abonamentul rămâne activ până la ${subEndsDate}.`,
      }
    }

    return {
      title: 'Subscripție activată',
      done: true,
      desc: sub.status === 'trialing'
        ? `Trial activ — ${trialDaysLeft(sub.trialEndsAt)} rămase.`
        : 'Abonamentul este activ.',
    }
  })()
  const trialPanel = (() => {
    if (sub?.status === 'trialing') {
      return {
        value: trialDaysLeft(sub.trialEndsAt),
        label: sub.cancelAtPeriodEnd ? `acces până la ${subEndsDate}` : 'rămase din trial',
      }
    }
    if (sub?.status === 'active') {
      return {
        value: '—',
        label: sub.cancelAtPeriodEnd ? `acces până la ${subEndsDate}` : 'subscripție activă',
      }
    }
    if (sub?.status === 'canceled') {
      return { value: 'Anulat', label: 'subscripție anulată' }
    }
    return { value: '7 zile', label: 'trial disponibil' }
  })()

  const trialPopupDays = sub?.trialEndsAt ? Math.ceil((sub.trialEndsAt - Date.now()) / 86_400_000) : 0

  return (
    <div>
      {/* Popup expirare trial */}
      {showTrialPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={dismissTrialPopup}>
          <div
            className="bg-base border border-line rounded-2xl p-6 max-w-md w-full shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="font-display text-[20px] text-ink leading-tight">
                  {trialPopupDays <= 1 ? 'Trial-ul expiră curând!' : `Trial-ul expiră în ${trialPopupDays} zile`}
                </h2>
                <p className="font-mono-ui text-[13px] text-dim mt-1">
                  După expirare, agentul AI nu va mai răspunde automat. Activează un abonament ca să nu pierzi conversațiile.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={() => { dismissTrialPopup(); router.push('/subscribe') }}
                style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
                className="flex-1 font-mono-ui text-[13px] font-medium px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
              >
                Vezi planurile
              </button>
              <button
                onClick={dismissTrialPopup}
                className="font-mono-ui text-[13px] text-dim hover:text-ink px-4 py-2.5 transition-colors"
              >
                Mai târziu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-[32px] text-ink leading-none">
            Bună, {user?.name?.split(' ')[0]}
          </h1>
          <p className="font-mono-ui text-[13px] text-dim mt-1">Dashboard-ul agentului tău AI</p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role !== 'admin' && (
            <span className={`font-mono-ui text-[11px] tracking-wide px-3 py-1.5 rounded-full ${statusColor}`}>
              {statusText}
            </span>
          )}
          {sub && sub.status !== 'incomplete' && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handlePortal}
                disabled={loadingPortal}
                className="font-mono-ui text-[13px] text-dim hover:text-ink flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                {loadingPortal ? 'Se încarcă…' : 'Gestionează subscripția'} <ExternalLink className="h-3.5 w-3.5" />
              </button>
              {portalError && <p className="font-mono-ui text-[12px] text-red-500 dark:text-red-400">Nu e disponibil momentan.</p>}
            </div>
          )}
        </div>
      </div>

      {/* Banners */}
      {showCheckoutSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="font-mono-ui text-[13px] text-green-800 dark:text-green-300">
            <strong>Plată procesată!</strong> Trial-ul de 7 zile a început. Agentul va fi activat în curând de echipa noastră.
          </p>
        </div>
      )}
      {sub?.cancelAtPeriodEnd && sub.status !== 'canceled' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6 flex items-center gap-3">
          <p className="font-mono-ui text-[13px] text-amber-800 dark:text-amber-300">
            <strong>Subscripție anulată.</strong> {sub.status === 'trialing' ? 'Trialul' : 'Abonamentul'} rămâne activ până la {subEndsDate}.
          </p>
        </div>
      )}
      {aiSettings?.adminDisabled && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-6 flex items-center gap-3">
          <p className="font-mono-ui text-[13px] text-orange-800 dark:text-orange-300">
            <strong>Agentul a fost dezactivat de administrator.</strong> Contactează suportul pentru detalii și reactivare.
          </p>
        </div>
      )}
      {sub?.status === 'past_due' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 flex items-center gap-3">
          <p className="font-mono-ui text-[13px] text-red-800 dark:text-red-300">
            <strong>Plată eșuată.</strong> Agentul a fost dezactivat. Actualizează metoda de plată pentru a reactiva.
          </p>
          <button onClick={handlePortal} className="ml-auto font-mono-ui text-[13px] font-medium text-red-700 dark:text-red-400 underline whitespace-nowrap">
            Actualizează plata
          </button>
        </div>
      )}
      {!showCheckoutSuccess && (!sub || sub.status === 'incomplete') && user?.role !== 'admin' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-8 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <p className="font-mono-ui text-[13px] text-amber-800 dark:text-amber-300">
            <strong>Pasul următor:</strong> Agentul tău nu este încă activ. Echipa noastră îl va activa în curând după ce verificăm contul tău.
          </p>
        </div>
      )}

      {/* Status bar — 3 secțiuni flat */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--line)] border border-line rounded-xl mb-8 overflow-hidden">

        {/* Agent AI */}
        <div className={`p-5 flex flex-col gap-3 transition-colors ${
          initialLoaded && aiSettings?.isActive && !aiSettings?.adminDisabled ? 'bg-acid/5' : ''
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className={`h-4 w-4 ${
                !initialLoaded ? 'text-dimmer' :
                aiSettings?.adminDisabled ? 'text-orange-500' :
                aiSettings?.isActive ? 'text-acid' : 'text-dimmer'
              }`} />
              <span className="font-mono-ui text-[12px] text-dim">Agent AI</span>
            </div>
            <button
              onClick={handleToggleAI}
              disabled={!initialLoaded || togglingAI || !canToggleAI}
              style={initialLoaded && aiSettings?.isActive ? { background: 'var(--acid)' } : undefined}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                initialLoaded && aiSettings?.isActive ? '' : 'bg-cardhi border border-line'
              }`}
              title={aiSettings?.adminDisabled ? 'Dezactivat de administrator' : undefined}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                initialLoaded && aiSettings?.isActive ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          <div>
            <p className={`font-display text-[22px] leading-none ${
              !initialLoaded ? 'text-dimmer' :
              aiSettings?.adminDisabled ? 'text-orange-600 dark:text-orange-400' :
              aiSettings?.isActive ? 'text-acid' : 'text-dimmer'
            }`}>
              {!initialLoaded ? '—' : aiSettings?.adminDisabled ? 'Blocat' : aiSettings?.isActive ? 'Activ' : 'Inactiv'}
            </p>
            <p className="font-mono-ui text-[12px] text-dimmer mt-1">
              {!initialLoaded ? '—' :
                aiSettings?.adminDisabled ? 'Contactează suportul' :
                aiSettings?.isActive ? `Timer: ${aiSettings.timerMinutes} min inactivitate` :
                'Apasă toggle pentru a activa'}
            </p>
          </div>
          {canToggleAI && (
            <button onClick={() => router.push('/settings')} className="font-mono-ui text-[12px] text-acid hover:underline flex items-center gap-1 mt-auto">
              <Settings className="h-3 w-3" /> Configurează
            </button>
          )}
        </div>

        {/* WhatsApp */}
        <div className="p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className={`h-4 w-4 ${isWaConnected ? 'text-green-500' : 'text-dimmer'}`} />
              <span className="font-mono-ui text-[12px] text-dim">WhatsApp</span>
            </div>
            {initialLoaded && isWaConnected && (
              <button
                onClick={handleWaDisconnect}
                disabled={waDisconnecting}
                className="flex items-center gap-1 font-mono-ui text-[11px] text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
              >
                {waDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WifiOff className="h-3.5 w-3.5" />}
                Deconectează
              </button>
            )}
          </div>
          <div>
            <p className={`font-display text-[22px] leading-none ${
              !initialLoaded ? 'text-dimmer' :
              isWaConnected ? 'text-green-600 dark:text-green-400' : 'text-dimmer'
            }`}>
              {!initialLoaded ? '—' : isWaConnected ? 'Conectat' : waSession?.status === 'pairing' ? 'Asociere…' : 'Neconectat'}
            </p>
            <p className="font-mono-ui text-[12px] text-dimmer mt-1">
              {!initialLoaded ? '—' : waSession?.phoneNumber ? `+${waSession.phoneNumber}` : 'Niciun număr asociat'}
            </p>
          </div>
          {initialLoaded && !isWaConnected && (
            <button
              onClick={() => setShowWaPanel(v => !v)}
              className="font-mono-ui text-[12px] text-acid hover:underline mt-auto text-left"
            >
              {showWaPanel ? 'Ascunde ↑' : 'Conectează acum →'}
            </button>
          )}
        </div>

        {/* Trial — ascuns pentru admin */}
        {user?.role !== 'admin' ? (
          <div className="p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500 dark:text-purple-400" />
              <span className="font-mono-ui text-[12px] text-dim">Trial</span>
            </div>
            <div>
              <p className="font-display text-[22px] leading-none text-purple-600 dark:text-purple-400">
                {trialPanel.value}
              </p>
              <p className="font-mono-ui text-[12px] text-dimmer mt-1">
                {trialPanel.label}
              </p>
            </div>
            <div className="flex items-center gap-1.5 mt-auto">
              <MessageSquare className="h-3 w-3 text-dimmer" />
              <span className="font-mono-ui text-[12px] text-dimmer">
                Mesaje AI (30z): {stats ? stats.month : '—'}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-5" />
        )}
      </div>

      {/* WhatsApp Connect Panel */}
      {showWaPanel && !isWaConnected && (
        <div className="border border-line rounded-xl p-6 mb-8 bg-cardhi/40">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-line">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-dim" />
              <div>
                <p className="font-mono-ui text-[14px] text-ink font-medium">Conectare WhatsApp</p>
                <p className="font-mono-ui text-[12px] text-dimmer mt-0.5">Scanează codul QR cu aplicația WhatsApp.</p>
              </div>
            </div>
            <button
              onClick={() => { setShowWaPanel(false); setQrCode(null); setWaError('') }}
              className="p-1.5 text-dimmer hover:text-ink hover:bg-cardhi rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {waError && (
            <p className="font-mono-ui text-[13px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4 text-center">{waError}</p>
          )}

          {!waConnecting && qrCode && (
            <div className="flex flex-col items-center gap-4">
              <p className="font-mono-ui text-[13px] text-dim text-center">
                Deschide WhatsApp → <strong className="text-ink">Dispozitive conectate</strong> → <strong className="text-ink">Conectează un dispozitiv</strong> → scanează codul
              </p>
              <div className="p-4 bg-white border-2 border-line rounded-xl">
                <QRCodeSVG value={qrCode} size={220} />
              </div>
              <div className="flex items-center gap-1.5 font-mono-ui text-[12px] text-amber-600 dark:text-amber-400">
                <RefreshCw className="h-3 w-3" />
                Codul se reîmprospătează automat la 20 de secunde
              </div>
            </div>
          )}

          {waConnecting && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-acid" />
              <p className="font-mono-ui text-[13px] text-dim">Se generează codul QR…</p>
            </div>
          )}

          {!waConnecting && !qrCode && (
            <div className="flex flex-col items-center gap-4 py-6">
              <button
                onClick={handleWaConnect}
                style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
                className="px-8 py-3 hover:opacity-90 font-mono-ui text-[14px] font-medium rounded-xl transition-opacity flex items-center gap-2"
              >
                Generează cod QR
              </button>
              <p className="font-mono-ui text-[12px] text-dimmer text-center max-w-sm">
                Apasă butonul, scanează QR-ul cu WhatsApp de pe telefon (Dispozitive conectate → Conectează un dispozitiv).
                Conexiunea persistă chiar și după repornirea serverului.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Activitate */}
      <div className="border-b border-line pb-8 mb-8">
        <p className="font-mono-ui text-[11px] text-dimmer tracking-widest uppercase mb-6">Activitate Agent AI</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: 'Azi', value: stats?.today ?? null },
            { label: 'Ultimele 7 zile', value: stats?.week ?? null },
            { label: 'Ultimele 30 zile', value: stats?.month ?? null },
            { label: 'Conversații totale', value: stats?.totalConversations ?? null },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <p className="font-mono-ui text-[11px] text-dimmer uppercase tracking-widest">{label}</p>
              <p className="font-display text-[32px] leading-none text-ink">
                {value === null ? '—' : value}
              </p>
              {value !== null && (
                <p className="font-mono-ui text-[11px] text-dimmer">
                  {label === 'Conversații totale' ? 'contacte unice' : 'mesaje AI'}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Performanță agent — metrici avansate */}
      {advStats && advStats.aiHandledConversations > 0 && (
        <div className="border-b border-line pb-8 mb-8">
          <p className="font-mono-ui text-[11px] text-dimmer tracking-widest uppercase mb-6">Performanță agent</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="flex flex-col gap-1">
              <p className="font-mono-ui text-[11px] text-dimmer uppercase tracking-widest">Preluate de AI</p>
              <p className="font-display text-[32px] leading-none text-ink">{advStats.aiHandledConversations}</p>
              <p className="font-mono-ui text-[11px] text-dimmer">conversații</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-mono-ui text-[11px] text-dimmer uppercase tracking-widest">Rezolvate de AI</p>
              <p className="font-display text-[32px] leading-none text-acid">{advStats.takeoverRate}%</p>
              <p className="font-mono-ui text-[11px] text-dimmer">fără intervenția ta</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-mono-ui text-[11px] text-dimmer uppercase tracking-widest">Preluate de tine</p>
              <p className="font-display text-[32px] leading-none text-ink">{advStats.escalatedConversations}</p>
              <p className="font-mono-ui text-[11px] text-dimmer">ai răspuns după AI</p>
            </div>
          </div>

          {/* Grafic bare — mesaje AI pe zi, ultimele 7 zile */}
          <div>
            <p className="font-mono-ui text-[11px] text-dimmer mb-3">Mesaje AI — ultimele 7 zile</p>
            <div className="flex items-end gap-2 h-32">
              {(() => {
                const max = Math.max(1, ...advStats.daily.map(d => d.count))
                return advStats.daily.map(({ date, count }) => {
                  const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('ro-RO', { weekday: 'short' })
                  return (
                    <div key={date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="font-mono-ui text-[10px] text-dim">{count > 0 ? count : ''}</span>
                      <div
                        className="w-full rounded-t-md transition-all"
                        style={{
                          height: `${Math.max(2, (count / max) * 100)}%`,
                          background: count > 0 ? 'var(--acid)' : 'var(--card-hi)',
                        }}
                      />
                      <span className="font-mono-ui text-[10px] text-dimmer">{dayLabel}</span>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Pași următori */}
      <div>
        <p className="font-mono-ui text-[11px] text-dimmer tracking-widest uppercase mb-6">Pașii următori</p>
        <div className="flex flex-col divide-y divide-[var(--line)]">
          {[
            { step: 1, title: 'Cont creat', done: true, desc: 'Contul tău este activ.' },
            ...(user?.role !== 'admin' ? [{
              step: 2,
              title: subscriptionStep.title,
              done: subscriptionStep.done,
              desc: subscriptionStep.desc,
            }] : []),
            {
              step: 3,
              title: 'Conectare WhatsApp',
              done: isWaConnected,
              desc: isWaConnected
                ? `Conectat: +${waSession?.phoneNumber}`
                : waSession?.status === 'pairing' ? 'Asociere în curs…' : 'Conectează numărul tău de WhatsApp.',
              action: !isWaConnected ? () => setShowWaPanel(true) : undefined,
              actionLabel: showWaPanel ? 'Panou deschis ↑' : 'Conectează acum',
            },
            {
              step: 4,
              title: 'Agent live',
              done: aiSettings?.isActive === true,
              desc: aiSettings?.adminDisabled
                ? 'Agentul a fost dezactivat de administrator. Contactează suportul.'
                : aiSettings?.isActive
                  ? 'Agentul AI preia conversațiile când ești indisponibil.'
                  : 'Activează agentul din bara de sus sau din Setări.',
              action: canToggleAI && !aiSettings?.isActive ? handleToggleAI : undefined,
              actionLabel: 'Activează acum',
            },
          ].map(({ step, title, done, desc, action, actionLabel }: { step: number; title: string; done: boolean; desc: string; action?: () => void; actionLabel?: string }) => (
            <div key={step} className="flex gap-4 py-4">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-mono-ui text-[12px] font-medium shrink-0 mt-0.5 ${done ? '' : 'bg-cardhi text-dimmer'}`}
                style={done ? { background: 'var(--acid)', color: 'var(--on-acid)' } : undefined}
              >
                {done ? '✓' : step}
              </div>
              <div className="flex-1">
                <p className={`font-mono-ui text-[14px] font-medium ${done ? 'text-ink' : 'text-dim'}`}>{title}</p>
                <p className="font-mono-ui text-[12px] text-dimmer mt-0.5">{desc}</p>
                {action && !done && (
                  <button onClick={action} className="font-mono-ui text-[12px] text-acid hover:underline mt-1 font-medium">
                    {actionLabel ?? 'Acțiune'} →
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
