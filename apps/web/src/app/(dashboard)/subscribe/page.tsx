'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Check, Zap } from 'lucide-react'

const PLANS = [
  {
    id: 'monthly' as const,
    label: 'LUNAR',
    price: '49.99',
    period: 'lună',
    description: 'Ideal pentru a testa platforma',
    features: ['Agent AI activ 24/7', 'Răspunsuri personalizate', 'Comenzi WhatsApp', 'Suport email'],
    recommended: false,
  },
  {
    id: 'annual' as const,
    label: 'ANUAL',
    price: '399',
    period: 'an',
    pricePerMonth: '33.25 RON/lună',
    badge: 'economisești 33%',
    description: 'Cel mai bun raport calitate-preț',
    features: ['Tot ce include planul lunar', 'Prioritate la noile funcții', 'Suport prioritar'],
    recommended: true,
  },
]

export default function SubscribePage() {
  const router = useRouter()
  const accessToken = useAuthStore(s => s.accessToken)
  const [loading, setLoading] = useState<'monthly' | 'annual' | null>(null)
  const [error, setError] = useState('')

  async function handleSelect(plan: 'monthly' | 'annual') {
    if (!accessToken) return router.push('/login')
    setLoading(plan)
    setError('')
    try {
      const { url } = await api.billing.createCheckout(accessToken, plan)
      window.location.href = url
    } catch {
      setError('A apărut o eroare. Încearcă din nou.')
      setLoading(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-4">
      <div className="text-center mb-10">
        <div className="font-mono-ui text-[10px] text-acid tracking-widest mb-3">→ TRIAL GRATUIT 7 ZILE</div>
        <h1 className="font-display text-[40px] text-ink leading-none mb-3">alege planul tău.</h1>
        <p className="font-mono-ui text-[13px] text-dim">cardul nu este debitat în perioada de trial</p>
      </div>

      {error && <Alert type="error" message={error} className="mb-6" />}

      <div className="grid md:grid-cols-2 gap-4">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-2xl border p-6 flex flex-col transition-all ${
              plan.recommended ? 'border-acid bg-cardhi' : 'border-line bg-card'
            }`}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span
                  className="font-mono-ui text-[10px] tracking-widest px-3 py-1 rounded-full inline-flex items-center gap-1 text-white dark:text-black"
                  style={{ background: 'var(--acid)' }}
                >
                  <Zap className="h-3 w-3" />
                  {plan.badge}
                </span>
              </div>
            )}

            <div className="mb-6">
              <p className="font-mono-ui text-[10px] text-dimmer tracking-widest mb-2">{plan.label}</p>
              <div className="flex items-end gap-1.5">
                <span className="font-display text-[42px] text-ink leading-none">{plan.price}</span>
                <span className="font-mono-ui text-[12px] text-dim mb-1">RON / {plan.period}</span>
              </div>
              {plan.pricePerMonth && (
                <p className="font-mono-ui text-[11px] text-acid mt-1">{plan.pricePerMonth}</p>
              )}
              <p className="font-mono-ui text-[12px] text-dim mt-2">{plan.description}</p>
            </div>

            <ul className="flex flex-col gap-2 mb-8 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 font-mono-ui text-[12px] text-dim">
                  <Check className="h-3.5 w-3.5 text-acid shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <Button
              onClick={() => handleSelect(plan.id)}
              disabled={loading !== null}
              loading={loading === plan.id}
              variant={plan.recommended ? 'primary' : 'secondary'}
              className="w-full"
            >
              începe trial gratuit →
            </Button>
          </div>
        ))}
      </div>

      <p className="font-mono-ui text-center text-[11px] text-dimmer mt-6">
        poți anula oricând. fără contracte, fără penalități.
      </p>
    </div>
  )
}
