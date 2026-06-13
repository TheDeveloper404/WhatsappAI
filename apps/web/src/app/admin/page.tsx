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
  const [secret, setSecret] = useState('')
  const [totp, setTotp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!secret.trim()) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(totp.trim() ? { secret, totp: totp.trim() } : { secret }),
      })
      if (!res.ok) {
        setError('Cod incorect. Încearcă din nou.')
        setSecret('')
        setTotp('')
        inputRef.current?.focus()
        return
      }
      // Stocăm token-ul de sesiune semnat (scurt), NU secretul brut.
      const data = await res.json()
      if (!data?.token) {
        setError('Răspuns invalid de la server.')
        return
      }
      sessionStorage.setItem('admin_token', data.token)
      router.push('/admin/dashboard')
    } catch {
      setError('Eroare de conexiune.')
    } finally {
      setLoading(false)
    }
  }

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
          <p className="font-mono-ui text-[12px] text-dimmer mt-2">introdu codul de acces</p>
        </div>

        <div className="card-elevated rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <input
              ref={inputRef}
              type="password"
              autoComplete="off"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="cod de acces"
              className="w-full h-12 px-4 text-center text-ink bg-cardhi border border-line rounded-xl font-mono-ui tracking-widest placeholder:tracking-normal placeholder:text-dimmer focus:outline-hidden focus:ring-2 focus:ring-acid/40 focus:border-acid transition-colors"
            />

            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={totp}
              onChange={e => setTotp(e.target.value.replace(/\D/g, ''))}
              placeholder="cod 2FA (dacă e activat)"
              className="w-full h-12 px-4 text-center text-ink bg-cardhi border border-line rounded-xl font-mono-ui tracking-widest placeholder:tracking-normal placeholder:text-dimmer focus:outline-hidden focus:ring-2 focus:ring-acid/40 focus:border-acid transition-colors"
            />

            {error && <Alert type="error" message={error} />}

            <Button
              type="submit"
              loading={loading}
              disabled={!secret.trim()}
              className="w-full h-11"
            >
              intră în admin →
            </Button>
          </form>
        </div>

        <p className="font-mono-ui text-center text-[11px] text-dimmer mt-6">
          waai · panou administrare intern
        </p>

      </div>
    </div>
  )
}
