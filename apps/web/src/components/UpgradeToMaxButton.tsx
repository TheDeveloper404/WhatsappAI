'use client'
import { useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Loader2, Zap, Check } from 'lucide-react'

// Buton „Treci pe Max" cu dialog de confirmare. Face upgrade IN-PLACE pe abonamentul existent
// (`POST /billing/upgrade`) — NU checkout nou. Stripe pune diferența proratată pe factura următoare;
// nu se debitează nimic pe loc. `onUpgraded` lasă pagina-părinte să-și actualizeze starea (ex. isMax).
export function UpgradeToMaxButton({
  className,
  style,
  label = 'Treci pe Max',
  onUpgraded,
}: {
  className?: string
  style?: React.CSSProperties
  label?: string
  onUpgraded?: () => void
}) {
  const accessToken = useAuthStore(s => s.accessToken)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function confirm() {
    if (!accessToken || loading) return
    setLoading(true); setError('')
    try {
      await api.billing.upgradeToMax(accessToken)
      setDone(true)
      onUpgraded?.()
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Upgrade eșuat. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(''); setDone(false) }}
        className={className}
        style={style}
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          onClick={() => { if (!loading) setOpen(false) }}
        >
          <div
            className="bg-base border border-line rounded-2xl p-6 max-w-md w-full shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {done ? (
              <div>
                <div className="flex items-start gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                    <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h2 className="font-display text-[20px] text-ink leading-tight">Ești pe Max!</h2>
                    <p className="font-mono-ui text-[13px] text-dim mt-1">
                      Toate funcțiile premium sunt acum active. Diferența de preț pentru perioada rămasă apare pe factura următoare.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
                  className="w-full font-mono-ui text-[13px] font-medium px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Gata
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-acid/15 flex items-center justify-center shrink-0">
                    <Zap className="h-5 w-5 text-acid" />
                  </div>
                  <div>
                    <h2 className="font-display text-[20px] text-ink leading-tight">Treci pe planul Max</h2>
                    <p className="font-mono-ui text-[13px] text-dim mt-1">
                      Deblochezi instant toate funcțiile Max (răspunsuri nelimitate, vision, calificare lead-uri, timer de la 1 min).
                      Diferența de preț pentru zilele rămase din ciclul curent apare pe <strong className="text-ink">factura următoare</strong> — nu se debitează nimic acum.
                    </p>
                  </div>
                </div>

                {error && (
                  <p className="font-mono-ui text-[12px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-4">{error}</p>
                )}

                <div className="flex items-center gap-3 mt-5">
                  <button
                    onClick={confirm}
                    disabled={loading}
                    style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
                    className="flex-1 flex items-center justify-center gap-2 font-mono-ui text-[13px] font-medium px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {loading ? 'Se aplică…' : 'Confirmă upgrade'}
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    disabled={loading}
                    className="font-mono-ui text-[13px] text-dim hover:text-ink px-4 py-2.5 transition-colors disabled:opacity-50"
                  >
                    Anulează
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
