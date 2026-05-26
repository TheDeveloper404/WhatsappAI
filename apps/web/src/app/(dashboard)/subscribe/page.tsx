'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Check, Loader2, Zap } from 'lucide-react'

const PLANS = [
  {
    id: 'monthly' as const,
    label: 'Lunar',
    price: '49.99',
    period: 'lună',
    description: 'Ideal pentru a testa platforma',
    features: ['Agent AI activ 24/7', 'Răspunsuri personalizate', 'Comenzi WhatsApp', 'Suport email'],
  },
  {
    id: 'annual' as const,
    label: 'Anual',
    price: '399',
    period: 'an',
    pricePerMonth: '33.25',
    badge: 'Economisești 33%',
    description: 'Cel mai bun raport calitate-preț',
    features: ['Tot ce include planul lunar', 'Prioritate la noile funcții', 'Suport prioritar'],
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
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Alege planul tău</h1>
        <p className="text-gray-500">7 zile trial gratuit — cardul nu este debitat imediat</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-center">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-white rounded-2xl border-2 p-6 flex flex-col ${
              plan.id === 'annual' ? 'border-primary-500 shadow-lg shadow-primary-100' : 'border-gray-200'
            }`}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary-600 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {plan.badge}
                </span>
              </div>
            )}

            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">{plan.label}</p>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-gray-500 mb-1">RON / {plan.period}</span>
              </div>
              {plan.pricePerMonth && (
                <p className="text-sm text-primary-600 font-medium mt-1">{plan.pricePerMonth} RON/lună</p>
              )}
              <p className="text-sm text-gray-500 mt-2">{plan.description}</p>
            </div>

            <ul className="flex flex-col gap-2 mb-8 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                  <Check className="h-4 w-4 text-primary-600 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelect(plan.id)}
              disabled={loading !== null}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
                plan.id === 'annual'
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
              }`}
            >
              {loading === plan.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Începe trial gratuit'
              )}
            </button>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">
        Poți anula oricând din dashboard. Fără contracte, fără penalități.
      </p>
    </div>
  )
}
