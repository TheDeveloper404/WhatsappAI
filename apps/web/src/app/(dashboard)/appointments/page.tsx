'use client'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { api, type Appointment, type AppointmentStatus } from '@/lib/api'
import { Loader2, CalendarClock, ChevronDown, Trash2 } from 'lucide-react'
import { SalesTabs } from '@/components/SalesTabs'
import { formatAmount, currencyLabel } from '@/lib/format'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Ora confirmată, afișată clar: „joi, 18 iun., 09:00".
function formatSlot(ts: number): string {
  return new Date(ts).toLocaleString('ro-RO', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Valoare implicită pentru pickerul de confirmare: peste ~1h, format datetime-local (ora locală = RO).
function defaultConfirmValue(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STATUS_META: Record<AppointmentStatus, { label: string; color: string }> = {
  pending:   { label: 'În așteptare', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  confirmed: { label: 'Confirmată',   color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  completed: { label: 'Finalizată',   color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  cancelled: { label: 'Anulată',      color: 'bg-cardhi text-dim' },
}

const STATUS_OPTIONS: AppointmentStatus[] = ['pending', 'confirmed', 'completed', 'cancelled']

const FILTERS: { id: 'all' | AppointmentStatus; label: string }[] = [
  { id: 'all', label: 'Toate' },
  { id: 'pending', label: 'În așteptare' },
  { id: 'confirmed', label: 'Confirmate' },
  { id: 'completed', label: 'Finalizate' },
  { id: 'cancelled', label: 'Anulate' },
]

export default function AppointmentsPage() {
  const { accessToken } = useAuthStore()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | AppointmentStatus>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [currency, setCurrency] = useState('RON')
  // Confirmare cu dată+oră: id-ul programării în curs de confirmare + valoarea din picker.
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmValue, setConfirmValue] = useState('')

  useEffect(() => {
    if (!accessToken) return
    Promise.all([
      api.appointments.list(accessToken),
      api.ai.getSettings(accessToken).catch(() => null),
    ])
      .then(([{ appointments: a }, settingsRes]) => {
        setAppointments(a)
        if (settingsRes?.settings.currency) setCurrency(settingsRes.settings.currency)
      })
      .catch(() => setError('Nu s-au putut încărca programările.'))
      .finally(() => setLoading(false))
  }, [accessToken])

  async function handleStatusChange(id: string, status: AppointmentStatus, scheduledAt?: number) {
    if (!accessToken) return
    setUpdatingId(id)
    setError(null)
    setNotice(null)
    try {
      const { notified } = await api.appointments.updateStatus(accessToken, id, status, scheduledAt)
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status, ...(scheduledAt != null ? { scheduledAt } : {}) } : a))
      setConfirmingId(null)
      // Feedback despre notificarea clientului (doar pentru tranziții care trimit mesaj).
      if (status !== 'pending') {
        setNotice(notified
          ? '✅ Clientul a fost notificat pe WhatsApp.'
          : 'ℹ️ Status salvat. Clientul NU a fost notificat (WhatsApp neconectat).')
        setTimeout(() => setNotice(null), 5000)
      }
    } catch {
      setError('Eroare la actualizarea statusului.')
    } finally {
      setUpdatingId(null)
    }
  }

  // La confirmare cerem ÎNTÂI data+ora (owner-ul e autoritatea pe oră); restul tranzițiilor merg direct.
  function onStatusSelect(id: string, status: AppointmentStatus) {
    if (status === 'confirmed') {
      setConfirmingId(id)
      setConfirmValue(defaultConfirmValue())
    } else {
      handleStatusChange(id, status)
    }
  }

  function submitConfirm(id: string) {
    const ts = new Date(confirmValue).getTime()
    if (!confirmValue || Number.isNaN(ts)) return
    handleStatusChange(id, 'confirmed', ts)
  }

  async function handleDelete(id: string) {
    if (!accessToken) return
    if (!confirm('Ștergi această programare definitiv?')) return
    setDeletingId(id)
    setError(null)
    try {
      await api.appointments.remove(accessToken, id)
      setAppointments(prev => prev.filter(a => a.id !== id))
    } catch {
      setError('Eroare la ștergerea programării.')
    } finally {
      setDeletingId(null)
    }
  }

  const visible = filter === 'all' ? appointments : appointments.filter(a => a.status === filter)
  const pendingCount = appointments.filter(a => a.status === 'pending').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-acid" />
      </div>
    )
  }

  return (
    <div>
      <SalesTabs />
      <div className="mb-8">
        <h1 className="font-display text-[32px] text-ink leading-none">Programări</h1>
        <p className="font-mono-ui text-[13px] text-dim mt-1">
          Cererile de programare primite prin WhatsApp.{pendingCount > 0 && <span className="text-amber-600 dark:text-amber-400"> {pendingCount} de confirmat.</span>}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 font-mono-ui text-[13px] text-red-700 dark:text-red-300 mb-6">{error}</div>
      )}

      {notice && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 font-mono-ui text-[13px] text-green-700 dark:text-green-300 mb-6">{notice}</div>
      )}

      {/* Filtre */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`font-mono-ui text-[12px] px-3 py-1.5 rounded-full transition-colors ${
              filter === id ? 'bg-ink text-base' : 'bg-cardhi text-dim hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="border border-dashed border-line rounded-xl py-16 flex flex-col items-center gap-3">
          <CalendarClock className="h-8 w-8 text-dimmer" />
          <p className="font-mono-ui text-[13px] text-dimmer">
            {filter === 'all' ? 'Nicio programare încă.' : 'Nicio programare cu acest status.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map(appt => {
            const meta = STATUS_META[appt.status]
            return (
              <li key={appt.id} className="border border-line rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono-ui text-[14px] text-ink font-medium">+{appt.contactPhone}</p>
                      {appt.publicRef && (
                        <span className="font-mono-ui text-[11px] text-dim bg-cardhi rounded-md px-1.5 py-0.5">{appt.publicRef}</span>
                      )}
                      {appt.isQuote && (
                        <span className="font-mono-ui text-[10px] text-acid bg-acid/10 rounded-full px-2 py-0.5">cerere deviz</span>
                      )}
                    </div>
                    <p className="font-mono-ui text-[11px] text-dimmer mt-0.5">{formatDate(appt.createdAt)}</p>
                  </div>
                  <span className={`font-mono-ui text-[11px] px-3 py-1 rounded-full shrink-0 ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>

                {appt.items && appt.items.length > 0 ? (
                  <div className="mb-1">
                    {appt.items.map(it => (
                      <p key={it.id} className="font-mono-ui text-[14px] text-ink flex items-center justify-between gap-3">
                        <span>{it.serviceName}</span>
                        {it.unitPriceBani > 0 && (
                          <span className="text-dim text-[13px]">{formatAmount(it.unitPriceBani)} {currencyLabel(currency)}</span>
                        )}
                      </p>
                    ))}
                    {appt.items.length > 1 && appt.totalBani > 0 && (
                      <p className="font-mono-ui text-[13px] text-ink font-medium mt-1 pt-1 border-t border-line flex items-center justify-between">
                        <span>Total</span>
                        <span>{formatAmount(appt.totalBani)} {currencyLabel(currency)}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="font-mono-ui text-[14px] text-ink mb-1">{appt.serviceName}</p>
                )}
                {appt.scheduledAt && (
                  <p className="font-mono-ui text-[13px] text-ink flex items-center gap-1.5 mt-0.5">
                    <CalendarClock className="h-3.5 w-3.5 text-acid" />
                    Programat: {formatSlot(appt.scheduledAt)}
                  </p>
                )}
                {appt.requestedSlot && (
                  <p className="font-mono-ui text-[13px] text-dim flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5 text-dimmer" />
                    Interval dorit: {appt.requestedSlot}
                  </p>
                )}

                {appt.details && (
                  <p className="font-mono-ui text-[12px] text-dim bg-cardhi/60 rounded-lg px-3 py-2 mt-3 whitespace-pre-wrap">
                    📝 {appt.details}
                  </p>
                )}

                {confirmingId === appt.id && (
                  <div className="mt-3 pt-3 border-t border-line flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="font-mono-ui text-[12px] text-dim shrink-0">Data și ora:</label>
                    <input
                      type="datetime-local"
                      value={confirmValue}
                      onChange={e => setConfirmValue(e.target.value)}
                      className="font-mono-ui text-[12px] text-ink bg-cardhi border border-line rounded-lg px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-acid/40"
                    />
                    <div className="flex gap-2 sm:ml-auto">
                      <button
                        onClick={() => submitConfirm(appt.id)}
                        disabled={!confirmValue || updatingId === appt.id}
                        className="font-mono-ui text-[12px] bg-acid text-white dark:text-black rounded-lg px-3 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        {updatingId === appt.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirmă & notifică'}
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        className="font-mono-ui text-[12px] text-dim hover:text-ink rounded-lg px-3 py-2"
                      >
                        Renunță
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-line">
                  <div className="relative">
                    <select
                      value={appt.status}
                      onChange={e => onStatusSelect(appt.id, e.target.value as AppointmentStatus)}
                      disabled={updatingId === appt.id}
                      className="appearance-none font-mono-ui text-[12px] text-ink bg-cardhi border border-line rounded-lg pl-3 pr-8 py-2 focus:outline-hidden focus:ring-2 focus:ring-acid/40 cursor-pointer disabled:opacity-50"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{STATUS_META[s].label}</option>
                      ))}
                    </select>
                    {updatingId === appt.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin text-dim absolute right-2.5 top-1/2 -translate-y-1/2" />
                      : <ChevronDown className="h-3.5 w-3.5 text-dim absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    }
                  </div>
                  <button
                    onClick={() => handleDelete(appt.id)}
                    disabled={deletingId === appt.id}
                    aria-label="Șterge programarea"
                    title="Șterge programarea"
                    className="p-2 rounded-lg text-dim hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  >
                    {deletingId === appt.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />
                    }
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
