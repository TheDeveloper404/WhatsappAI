'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Shield } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function AdminLoginPage() {
  const router = useRouter()
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const ref0 = useRef<HTMLInputElement>(null)
  const ref1 = useRef<HTMLInputElement>(null)
  const ref2 = useRef<HTMLInputElement>(null)
  const ref3 = useRef<HTMLInputElement>(null)
  const inputRefs = [ref0, ref1, ref2, ref3]

  useEffect(() => { ref0.current?.focus() }, [])

  function handleChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return
    const next = [...pin]
    next[index] = value
    setPin(next)
    if (value && index < 3) inputRefs[index + 1].current?.focus()
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const secret = pin.join('')
    if (secret.length < 4) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      })
      if (!res.ok) {
        setError('Cod incorect. Încearcă din nou.')
        setPin(['', '', '', ''])
        ref0.current?.focus()
        return
      }
      sessionStorage.setItem('admin_token', secret)
      router.push('/admin/dashboard')
    } catch {
      setError('Eroare de conexiune.')
    } finally {
      setLoading(false)
    }
  }

  const pinComplete = pin.every(d => d !== '')

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-5"
            style={{ background: 'var(--acid)' }}
          >
            <Shield className="h-6 w-6" style={{ color: 'var(--on-acid)' }} />
          </span>
          <div className="font-mono-ui text-[10px] text-acid tracking-widest mb-2">→ ACCES RESTRICȚIONAT</div>
          <h1 className="font-display text-[32px] text-ink leading-none">admin panel.</h1>
          <p className="font-mono-ui text-[12px] text-dimmer mt-2">introdu codul de 4 cifre</p>
        </div>

        <div className="card-elevated rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex gap-3 justify-center">
              {pin.map((digit, i) => (
                <input
                  key={i}
                  ref={inputRefs[i]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className="w-14 h-16 text-center text-[28px] font-display text-ink bg-cardhi border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-acid/40 focus:border-acid transition-colors"
                />
              ))}
            </div>

            {error && <Alert type="error" message={error} />}

            <Button
              type="submit"
              loading={loading}
              disabled={!pinComplete}
              className="w-full h-11"
            >
              intră în admin →
            </Button>
          </form>
        </div>

        <p className="font-mono-ui text-center text-[11px] text-dimmer mt-6">
          WhatsApp AI · panou administrare intern
        </p>

      </div>
    </div>
  )
}
