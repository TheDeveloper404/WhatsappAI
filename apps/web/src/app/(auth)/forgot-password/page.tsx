'use client'
import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { api, ApiRequestError } from '@/lib/api'
import { CheckCircle2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.auth.forgotPassword(email)
      setSent(true)
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.message)
      else setError('A apărut o eroare. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <CheckCircle2 className="h-12 w-12 text-acid mx-auto mb-4" />
        <h2 className="font-display text-[28px] text-ink leading-none mb-2">email trimis.</h2>
        <p className="font-mono-ui text-[12px] text-dim mt-2">
          Dacă există un cont cu adresa <strong className="text-ink">{email}</strong>, vei primi un link de resetare în câteva minute.
        </p>
        <Link href="/login" className="mt-6 inline-block font-mono-ui text-[12px] text-acid hover:opacity-75 transition-opacity">
          ← înapoi la login
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="mb-7">
        <div className="font-mono-ui text-[10px] text-acid tracking-widest mb-3">→ RESETARE PAROLĂ</div>
        <h1 className="font-display text-[32px] text-ink">ai uitat parola?</h1>
        <p className="font-mono-ui text-[12px] text-dimmer mt-1.5">îți trimitem un link pe email</p>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

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
        <Button type="submit" loading={loading} className="w-full h-11 text-[14px]">
          trimite link de resetare →
        </Button>
      </form>

      <p className="font-mono-ui text-center text-[12px] text-dimmer mt-6">
        <Link href="/login" className="text-acid hover:opacity-75 transition-opacity">
          ← înapoi la login
        </Link>
      </p>
    </>
  )
}
