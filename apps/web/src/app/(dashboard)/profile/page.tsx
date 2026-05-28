'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { api, type Subscription } from '@/lib/api'
import { Loader2, Mail, Shield, CreditCard, HeadphonesIcon, Trash2 } from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const { user, accessToken, clearAuth } = useAuthStore()

  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loadingSub, setLoadingSub] = useState(true)
  const [sendingReset, setSendingReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
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

  async function handleDeleteAccount() {
    if (!accessToken || confirmDelete !== 'STERG') return
    setDeletingAccount(true)
    setError(null)
    try {
      await api.users.deleteAccount(accessToken)
      clearAuth()
      router.push('/')
    } catch {
      setError('Eroare la ștergerea contului. Contactează suportul.')
      setDeletingAccount(false)
    }
  }

  const planLabel = subscription
    ? subscription.plan === 'annual' ? 'Anual' : 'Lunar'
    : null

  const statusLabel: Record<string, string> = {
    trialing: 'Trial activ',
    active: 'Activ',
    past_due: 'Plată restantă',
    canceled: 'Anulat',
    incomplete: 'Incomplet',
  }

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="mb-6">
        <h1 className="font-display text-[32px] text-ink leading-none">Profil</h1>
        <p className="font-mono-ui text-[12px] text-dim mt-1">Gestionează contul și setările personale.</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 font-mono-ui text-[12px] text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Informații cont */}
      <div className="card-elevated rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Mail className="h-4 w-4 text-dimmer" />
          <h2 className="font-mono-ui text-[12px] text-ink font-medium">Informații cont</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center font-mono-ui text-[16px] font-bold flex-shrink-0"
            style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-mono-ui text-[14px] text-ink font-medium truncate">{user?.name}</p>
            <p className="font-mono-ui text-[12px] text-dim truncate">{user?.email}</p>
            <p className="font-mono-ui text-[10px] text-dimmer mt-0.5">
              {user?.emailVerified ? '✓ Email verificat' : '⚠ Email neverificat'}
            </p>
          </div>
        </div>
      </div>

      {/* Securitate */}
      <div className="card-elevated rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-dimmer" />
          <h2 className="font-mono-ui text-[12px] text-ink font-medium">Securitate</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono-ui text-[12px] text-ink font-medium">Schimbă parola</p>
            <p className="font-mono-ui text-[11px] text-dimmer mt-0.5">Îți trimitem un link de resetare pe email.</p>
          </div>
          {resetSent ? (
            <span className="font-mono-ui text-[12px] text-green-600 dark:text-green-400 font-medium">Link trimis!</span>
          ) : (
            <button
              onClick={handleSendReset}
              disabled={sendingReset}
              className="flex items-center gap-2 font-mono-ui text-[12px] px-4 py-2 rounded-lg border border-line hover:bg-cardhi transition-colors disabled:opacity-50"
            >
              {sendingReset ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Trimite link
            </button>
          )}
        </div>
      </div>

      {/* Abonament */}
      <div className="card-elevated rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-4 w-4 text-dimmer" />
          <h2 className="font-mono-ui text-[12px] text-ink font-medium">Abonament</h2>
        </div>
        {loadingSub ? (
          <Loader2 className="h-4 w-4 animate-spin text-acid" />
        ) : subscription ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono-ui text-[12px] text-ink font-medium">
                Plan {planLabel} — {statusLabel[subscription.status] ?? subscription.status}
              </p>
              {subscription.currentPeriodEndsAt && (
                <p className="font-mono-ui text-[11px] text-dimmer mt-0.5">
                  {subscription.status === 'trialing' ? 'Trial expiră' : 'Reînnoire'}{' '}
                  {new Date(subscription.currentPeriodEndsAt).toLocaleDateString('ro-RO')}
                </p>
              )}
            </div>
            <button
              onClick={handleOpenPortal}
              disabled={openingPortal}
              className="flex items-center gap-2 font-mono-ui text-[12px] px-4 py-2 rounded-lg border border-line hover:bg-cardhi transition-colors disabled:opacity-50"
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
      <div className="card-elevated rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <HeadphonesIcon className="h-4 w-4 text-dimmer" />
          <h2 className="font-mono-ui text-[12px] text-ink font-medium">Suport</h2>
        </div>
        <p className="font-mono-ui text-[12px] text-dim mb-3">
          Ai o problemă sau o întrebare? Suntem disponibili Luni–Vineri.
        </p>
        <a
          href="mailto:support@waai.ro"
          className="inline-flex items-center gap-2 font-mono-ui text-[12px] px-4 py-2 rounded-lg border border-line hover:bg-cardhi transition-colors"
        >
          <Mail className="h-3.5 w-3.5" />
          support@waai.ro
        </a>
      </div>

      {/* Zona periculoasă */}
      <div className="card-elevated rounded-xl p-6 border border-red-200 dark:border-red-900">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="h-4 w-4 text-red-500" />
          <h2 className="font-mono-ui text-[12px] text-red-600 dark:text-red-400 font-medium">Șterge contul</h2>
        </div>
        <p className="font-mono-ui text-[12px] text-dim mb-4">
          Acțiunea este ireversibilă. Toate datele, conversațiile și setările vor fi șterse permanent.
        </p>
        {!showDeleteModal ? (
          <button
            onClick={() => setShowDeleteModal(true)}
            className="font-mono-ui text-[12px] text-red-500 hover:text-red-600 border border-red-200 dark:border-red-800 px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Șterge contul
          </button>
        ) : (
          <div className="space-y-3">
            <p className="font-mono-ui text-[12px] text-dim">
              Scrie <span className="text-ink font-bold">STERG</span> pentru confirmare:
            </p>
            <input
              type="text"
              value={confirmDelete}
              onChange={e => setConfirmDelete(e.target.value)}
              placeholder="STERG"
              className="w-full rounded-xl border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-ink bg-cardhi focus:outline-none focus:ring-2 focus:ring-red-400/40 transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount || confirmDelete !== 'STERG'}
                className="flex items-center gap-2 font-mono-ui text-[12px] px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deletingAccount ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Confirmă ștergerea
              </button>
              <button
                onClick={() => { setShowDeleteModal(false); setConfirmDelete('') }}
                className="font-mono-ui text-[12px] px-4 py-2 rounded-lg border border-line hover:bg-cardhi transition-colors"
              >
                Anulează
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
