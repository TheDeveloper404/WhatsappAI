'use client'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { api, type Subscription } from '@/lib/api'
import { Loader2, Mail, Shield, CreditCard, HeadphonesIcon, AlertTriangle } from 'lucide-react'
import { DeleteAccountButton } from '@/components/DeleteAccountButton'

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('ro-RO')
}

export default function ProfilePage() {
  const { user, accessToken } = useAuthStore()

  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loadingSub, setLoadingSub] = useState(true)
  const [sendingReset, setSendingReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    api.billing.getSubscription(accessToken)
      .then(({ subscription: s }) => setSubscription(s))
      .catch(() => {})
      .finally(() => setLoadingSub(false))
  }, [accessToken])

  async function handleSendReset() {
    if (!user?.email) return
    setSendingReset(true)
    setError(null)
    try {
      await api.auth.forgotPassword(user.email)
      setResetSent(true)
    } catch {
      setError('Eroare la trimiterea emailului. Încearcă din nou.')
    } finally {
      setSendingReset(false)
    }
  }

  async function handleOpenPortal() {
    if (!accessToken) return
    setOpeningPortal(true)
    try {
      const { url } = await api.billing.createPortal(accessToken)
      window.location.href = url
    } catch {
      setError('Nu s-a putut deschide portalul de abonament.')
      setOpeningPortal(false)
    }
  }

  const planLabel = subscription
    ? subscription.plan === 'annual' ? 'Anual' : 'Lunar'
    : null
  // tier NULL = abonament legacy → Pro (grandfathering, ca în backend).
  const tierLabel = subscription
    ? subscription.tier === 'max' ? 'Max' : 'Pro'
    : null

  const statusLabel: Record<string, string> = {
    trialing: 'Trial activ',
    active: 'Activ',
    past_due: 'Plată restantă',
    canceled: 'Anulat',
    incomplete: 'Incomplet',
  }
  const subscriptionEnd = subscription?.cancelAt ?? (
    subscription?.status === 'trialing' ? subscription.trialEndsAt : subscription?.currentPeriodEndsAt
  )
  const subscriptionDateLabel = subscription?.cancelAtPeriodEnd
    ? 'Acces până la'
    : subscription?.status === 'trialing'
      ? 'Trial expiră'
      : 'Reînnoire'

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-[32px] text-ink leading-none">Profil</h1>
        <p className="font-mono-ui text-[12px] text-dim mt-1">Gestionează contul și setările personale.</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 font-mono-ui text-[12px] text-red-700 dark:text-red-300 mb-6">
          {error}
        </div>
      )}

      {/* Avatar + info cont */}
      <div className="flex items-center gap-4 pb-7 border-b border-line">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center font-mono-ui text-[18px] font-bold shrink-0"
          style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-mono-ui text-[15px] text-ink font-medium truncate">{user?.name}</p>
          <p className="font-mono-ui text-[12px] text-dim truncate">{user?.email}</p>
          <p className="font-mono-ui text-[10px] text-dimmer mt-0.5">
            {user?.emailVerified ? '✓ Email verificat' : '⚠ Email neverificat'}
          </p>
        </div>
      </div>

      <div className="divide-y divide-(--line)">

        {/* Securitate */}
        <div className="py-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-3.5 w-3.5 text-dimmer" />
            <p className="font-mono-ui text-[10px] text-dimmer uppercase tracking-widest">Securitate</p>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono-ui text-[13px] text-ink font-medium">Schimbă parola</p>
              <p className="font-mono-ui text-[11px] text-dimmer mt-0.5">Îți trimitem un link de resetare pe email.</p>
            </div>
            {resetSent ? (
              <span className="font-mono-ui text-[12px] text-green-600 dark:text-green-400 font-medium whitespace-nowrap">Link trimis!</span>
            ) : (
              <button
                onClick={handleSendReset}
                disabled={sendingReset}
                className="flex items-center gap-2 font-mono-ui text-[12px] px-4 py-2 rounded-lg border border-line hover:bg-cardhi transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {sendingReset ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Trimite link
              </button>
            )}
          </div>
        </div>

        {/* Abonament */}
        <div className="py-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-3.5 w-3.5 text-dimmer" />
            <p className="font-mono-ui text-[10px] text-dimmer uppercase tracking-widest">Abonament</p>
          </div>
          {loadingSub ? (
            <Loader2 className="h-4 w-4 animate-spin text-acid" />
          ) : subscription ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-ui text-[11px] font-semibold px-2 py-0.5 rounded-full bg-acid/15 text-acid uppercase tracking-wider">
                    {tierLabel}
                  </span>
                  <p className="font-mono-ui text-[13px] text-ink font-medium">
                    Facturare {planLabel} — {subscription.cancelAtPeriodEnd ? 'Anulat la final' : statusLabel[subscription.status] ?? subscription.status}
                  </p>
                </div>
                {subscriptionEnd && (
                  <p className="font-mono-ui text-[11px] text-dimmer mt-0.5">
                    {subscriptionDateLabel} {formatDate(subscriptionEnd)}
                  </p>
                )}
              </div>
              <button
                onClick={handleOpenPortal}
                disabled={openingPortal}
                className="flex items-center gap-2 font-mono-ui text-[12px] px-4 py-2 rounded-lg border border-line hover:bg-cardhi transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {openingPortal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Gestionează
              </button>
            </div>
          ) : (
            <p className="font-mono-ui text-[12px] text-dim">Niciun abonament activ.</p>
          )}
        </div>

        {/* Suport */}
        <div className="py-6">
          <div className="flex items-center gap-2 mb-4">
            <HeadphonesIcon className="h-3.5 w-3.5 text-dimmer" />
            <p className="font-mono-ui text-[10px] text-dimmer uppercase tracking-widest">Suport</p>
          </div>
          <p className="font-mono-ui text-[12px] text-dim mb-4">
            Disponibili Luni–Vineri pentru orice întrebare sau problemă.
          </p>
          <a
            href="mailto:support@waai.ro"
            className="inline-flex items-center gap-2 font-mono-ui text-[12px] px-4 py-2 rounded-lg border border-line hover:bg-cardhi transition-colors"
          >
            <Mail className="h-3.5 w-3.5" />
            support@waai.ro
          </a>
        </div>

        {/* Zonă periculoasă — ștergere cont */}
        <div className="py-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500/70" />
            <p className="font-mono-ui text-[10px] text-red-500/70 uppercase tracking-widest">Zonă periculoasă</p>
          </div>
          <p className="font-mono-ui text-[13px] text-ink font-medium">Șterge contul</p>
          <p className="font-mono-ui text-[11px] text-dimmer mt-0.5 mb-4">
            Contul și toate datele tale vor fi șterse. Ai la dispoziție 48 de ore în care contul
            poate fi recuperat; după aceea ștergerea e definitivă. Îți confirmăm cu parola.
          </p>
          <DeleteAccountButton />
        </div>

      </div>
    </div>
  )
}
