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
        <CheckCircle2 className="h-12 w-12 text-primary-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Email trimis</h2>
        <p className="text-sm text-gray-500">
          Dacă există un cont cu adresa <strong>{email}</strong>, vei primi un link de resetare în câteva minute.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm text-primary-600 hover:text-primary-700 font-medium">
          Înapoi la login
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Resetează parola</h1>
        <p className="text-sm text-gray-500 mt-1">Îți trimitem un link pe email</p>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="tu@business.com"
          autoComplete="email"
          required
        />
        <Button type="submit" loading={loading} className="w-full">
          Trimite link de resetare
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
          Înapoi la login
        </Link>
      </p>
    </>
  )
}
