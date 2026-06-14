'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Check, Zap } from 'lucide-react'
import {
  TIERS,
  perMonthFromAnnual,
  annualSavings,
  type BillingPeriod,
  type TierId,
} from '@/lib/plans'

export default function SubscribePage() {
  const router = useRouter()
  const accessToken = useAuthStore(s => s.accessToken)
  const [billing, setBilling] = useState<BillingPeriod>('annual')
  const [loading, setLoading] = useState<TierId | null>(null)
  const [error, setError] = useState('')

  async function handleSelect(tier: TierId) {
    if (!accessToken) return router.push('/login')
    setLoading(tier)
    setError('')
    try {
      const { url } = await api.billing.createCheckout(accessToken, billing, tier)
      window.location.assign(url)
    } catch {
      setError('A apărut o eroare. Încearcă din nou.')
      setLoading(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-4">
      <div className="text-center mb-8">
        <div className="font-mono-ui text-[10px] text-acid tracking-widest mb-3">→ TRIAL GRATUIT 7 ZILE</div>
        <h1 className="font-display text-[40px] text-ink leading-none mb-3">alege planul tău.</h1>
        <p className="font-mono-ui text-[13px] text-dim">cardul nu este debitat în perioada de trial</p>
      </div>

      {/* Toggle facturare lunar / anual */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex items-center gap-1 p-1 rounded-full border border-line bg-card">
          {(['monthly', 'annual'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setBilling(p)}
              className={`font-mono-ui text-[11px] tracking-widest uppercase px-4 py-1.5 rounded-full transition-colors ${
                billing === p ? 'bg-acid text-white dark:text-black' : 'text-dim hover:text-ink'
              }`}
            >
              {p === 'monthly' ? 'lunar' : 'anual'}
              {p === 'annual' && <span className="ml-1.5 normal-case tracking-normal opacity-80">· 2 luni gratis</span>}
            </button>
          ))}
        </div>
      </div>

      {error && <Alert type="error" message={error} className="mb-6" />}

      <div className="grid md:grid-cols-2 gap-4">
        {TIERS.map((tier) => {
          const price = billing === 'monthly' ? tier.monthly : tier.annual
          const period = billing === 'monthly' ? 'lună' : 'an'
          const saved = annualSavings(tier.monthly, tier.annual)
          // Cardul recomandat (Max) are fundal acid (ca pe landing) → textul devine on-acid.
          const rec = tier.recommended
          const onAcid = rec ? { color: 'var(--on-acid)' } : undefined
          const onAcidMuted = rec ? { color: 'var(--on-acid-muted)' } : undefined
          return (
            <div
              key={tier.id}
              className={`relative rounded-2xl border p-6 flex flex-col transition-all ${
                rec ? 'border-transparent shadow-xl' : 'border-line bg-card'
              }`}
              style={rec ? { background: 'var(--acid)' } : undefined}
            >
              {rec && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span
                    className="font-mono-ui text-[12px] tracking-widest px-3.5 py-1.5 rounded-full inline-flex items-center gap-1 font-bold"
                    style={{ background: 'var(--badge-rec)', color: 'var(--badge-rec-fg)' }}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    recomandat
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p className="font-mono-ui text-[10px] text-dimmer tracking-widest uppercase mb-2" style={onAcidMuted}>{tier.name}</p>
                <div className="flex items-end gap-1.5">
                  <span className="font-display text-[42px] text-ink leading-none" style={onAcid}>{price}</span>
                  <span className="font-mono-ui text-[12px] text-dim mb-1" style={onAcidMuted}>RON / {period}</span>
                </div>
                {billing === 'annual' && (
                  <p className="font-mono-ui text-[11px] text-acid mt-1" style={onAcid}>
                    ~{perMonthFromAnnual(tier.annual)} RON / lună · economisești {saved} RON / an
                  </p>
                )}
                <p className="font-mono-ui text-[12px] text-dim mt-2" style={onAcidMuted}>{tier.tagline}</p>
              </div>

              <ul className="flex flex-col gap-2 mb-8 flex-1">
                {tier.features.map((f, i) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2 font-mono-ui text-[12px] ${
                      i === 0 && tier.id === 'max' ? 'text-ink font-semibold' : 'text-dim'
                    }`}
                    style={onAcid}
                  >
                    <Check className="h-3.5 w-3.5 text-acid shrink-0 mt-0.5" style={onAcid} />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSelect(tier.id)}
                disabled={loading !== null}
                loading={loading === tier.id}
                variant={rec ? 'accent' : 'primary'}
                size={rec ? 'lg' : 'md'}
                className="w-full"
              >
                începe trial gratuit →
              </Button>
            </div>
          )
        })}
      </div>

      <p className="font-mono-ui text-center text-[11px] text-dimmer mt-6">
        poți anula oricând. fără contracte, fără penalități.
      </p>
    </div>
  )
}
