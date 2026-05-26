'use client'
import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore(s => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordReset, setPasswordReset] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setPasswordReset(params.get('reset') === '1')
    setEmailVerified(params.get('verified') === '1')
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user, accessToken } = await api.auth.login({ email, password })
      setAuth(user, accessToken)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A apărut o eroare. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mb-7">
        <div className="font-mono-ui text-[10px] text-acid tracking-widest mb-3">→ CONT EXISTENT</div>
        <h1 className="font-display text-[32px] text-ink">bun venit înapoi.</h1>
        <p className="font-mono-ui text-[12px] text-dimmer mt-1.5">intră în contul tău</p>
      </div>

      {passwordReset && (
        <Alert type="success" message="Parola salvată! Te poți loga acum." className="mb-5" />
      )}
      {emailVerified && !passwordReset && (
        <Alert type="success" message="Email verificat! Contul tău este activ." className="mb-5" />
      )}
      {error && (
        <Alert type="error" message={error} className="mb-5" />
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="tu@business.ro"
          autoComplete="email"
          required
        />
        <Input
          label="Parolă"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        <div className="flex justify-end -mt-1">
          <Link href="/forgot-password" className="font-mono-ui text-[11.5px] text-acid hover:opacity-75 transition-opacity">
            ai uitat parola?
          </Link>
        </div>

        <Button type="submit" loading={loading} className="w-full mt-2 h-11 text-[14px]">
          intră în cont →
        </Button>
      </form>

      <p className="font-mono-ui text-center text-[12px] text-dimmer mt-6">
        nu ai cont?{' '}
        <Link href="/signup" className="text-acid hover:opacity-75 transition-opacity">
          creează unul gratuit
        </Link>
      </p>
    </>
  )
}
