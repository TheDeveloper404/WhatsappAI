'use client'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { api, type Order, type OrderStatus } from '@/lib/api'
import { formatAmount, currencyLabel } from '@/lib/format'
import { Loader2, ShoppingCart, ChevronDown, Trash2 } from 'lucide-react'
import { SalesTabs } from '@/components/SalesTabs'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const STATUS_META: Record<OrderStatus, { label: string; color: string }> = {
  pending:   { label: 'În așteptare', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  confirmed: { label: 'Confirmată',   color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  completed: { label: 'Finalizată',   color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  cancelled: { label: 'Anulată',      color: 'bg-cardhi text-dim' },
}

const STATUS_OPTIONS: OrderStatus[] = ['pending', 'confirmed', 'completed', 'cancelled']

const FILTERS: { id: 'all' | OrderStatus; label: string }[] = [
  { id: 'all', label: 'Toate' },
  { id: 'pending', label: 'În așteptare' },
  { id: 'confirmed', label: 'Confirmate' },
  { id: 'completed', label: 'Finalizate' },
  { id: 'cancelled', label: 'Anulate' },
]

export default function OrdersPage() {
  const { accessToken } = useAuthStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [currency, setCurrency] = useState('RON')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | OrderStatus>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    Promise.all([
      api.orders.list(accessToken),
      api.ai.getSettings(accessToken).catch(() => null),
    ])
      .then(([{ orders: o }, settingsRes]) => {
        setOrders(o)
        if (settingsRes?.settings.currency) setCurrency(settingsRes.settings.currency)
      })
      .catch(() => setError('Nu s-au putut încărca comenzile.'))
      .finally(() => setLoading(false))
  }, [accessToken])

  async function handleStatusChange(id: string, status: OrderStatus) {
    if (!accessToken) return
    setUpdatingId(id)
    setError(null)
    setNotice(null)
    try {
      const { notified } = await api.orders.updateStatus(accessToken, id, status)
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
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

  async function handleDelete(id: string) {
    if (!accessToken) return
    if (!confirm('Ștergi această comandă definitiv?')) return
    setDeletingId(id)
    setError(null)
    try {
      await api.orders.remove(accessToken, id)
      setOrders(prev => prev.filter(o => o.id !== id))
    } catch {
      setError('Eroare la ștergerea comenzii.')
    } finally {
      setDeletingId(null)
    }
  }

  const visible = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const pendingCount = orders.filter(o => o.status === 'pending').length

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
        <h1 className="font-display text-[32px] text-ink leading-none">Comenzi</h1>
        <p className="font-mono-ui text-[13px] text-dim mt-1">
          Comenzile primite prin WhatsApp.{pendingCount > 0 && <span className="text-amber-600 dark:text-amber-400"> {pendingCount} în așteptare.</span>}
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
          <ShoppingCart className="h-8 w-8 text-dimmer" />
          <p className="font-mono-ui text-[13px] text-dimmer">
            {filter === 'all' ? 'Nicio comandă încă.' : 'Nicio comandă cu acest status.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map(order => {
            const meta = STATUS_META[order.status]
            return (
              <li key={order.id} className="border border-line rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono-ui text-[14px] text-ink font-medium">+{order.contactPhone}</p>
                      {order.publicRef && (
                        <span className="font-mono-ui text-[11px] text-dim bg-cardhi rounded-md px-1.5 py-0.5">{order.publicRef}</span>
                      )}
                    </div>
                    <p className="font-mono-ui text-[11px] text-dimmer mt-0.5">{formatDate(order.createdAt)}</p>
                  </div>
                  <span className={`font-mono-ui text-[11px] px-3 py-1 rounded-full shrink-0 ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>

                <ul className="space-y-1 mb-3">
                  {order.items.map(it => (
                    <li key={it.id} className="flex items-center justify-between font-mono-ui text-[13px]">
                      <span className="text-dim">{it.quantity}× {it.productName}</span>
                      <span className="text-ink">{formatAmount(it.unitPriceBani * it.quantity)} {currencyLabel(currency)}</span>
                    </li>
                  ))}
                </ul>

                {order.details && (
                  <p className="font-mono-ui text-[12px] text-dim bg-cardhi/60 rounded-lg px-3 py-2 mb-3 whitespace-pre-wrap">
                    🧾 {order.details}
                  </p>
                )}

                {order.customerNote && (
                  <p className="font-mono-ui text-[12px] text-dim bg-cardhi/60 rounded-lg px-3 py-2 mb-3">
                    📝 {order.customerNote}
                  </p>
                )}

                {(order.deliveryMethod || order.deliveryAddress) && (
                  <div className="font-mono-ui text-[12px] text-dim bg-cardhi/60 rounded-lg px-3 py-2 mb-3 space-y-0.5">
                    {order.deliveryMethod === 'delivery' && <p>🚚 Livrare prin curier</p>}
                    {order.deliveryMethod === 'pickup' && <p>🏪 Ridicare din locație</p>}
                    {order.deliveryAddress && <p className="whitespace-pre-wrap">📍 {order.deliveryAddress}</p>}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-line">
                  <span className="font-display text-[20px] text-ink">
                    {formatAmount(order.totalBani)} <span className="text-[12px] text-dim">{currencyLabel(currency)}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <select
                        value={order.status}
                        onChange={e => handleStatusChange(order.id, e.target.value as OrderStatus)}
                        disabled={updatingId === order.id}
                        className="appearance-none font-mono-ui text-[12px] text-ink bg-cardhi border border-line rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-acid/40 cursor-pointer disabled:opacity-50"
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{STATUS_META[s].label}</option>
                        ))}
                      </select>
                      {updatingId === order.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin text-dim absolute right-2.5 top-1/2 -translate-y-1/2" />
                        : <ChevronDown className="h-3.5 w-3.5 text-dim absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      }
                    </div>
                    <button
                      onClick={() => handleDelete(order.id)}
                      disabled={deletingId === order.id}
                      aria-label="Șterge comanda"
                      title="Șterge comanda"
                      className="p-2 rounded-lg text-dim hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      {deletingId === order.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />
                      }
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
