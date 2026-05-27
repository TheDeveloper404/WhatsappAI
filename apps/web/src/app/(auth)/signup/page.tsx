'use client'
import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { api, ApiRequestError } from '@/lib/api'
import { Check, X } from 'lucide-react'

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${met ? 'text-green-600' : 'text-gray-400'}`}>
      {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </li>
  )
}

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const rules = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Parolele nu se potrivesc.' })
      return
    }

    setLoading(true)
    try {
      await api.auth.register({ name, email, password })
      setSuccess(true)
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.details?.length) {
          const map: Record<string, string> = {}
          err.details.forEach(d => { map[d.field] = d.message })
          setFieldErrors(map)
        } else {
          setError(err.message)
        }
      } else {
        setError('A apărut o eroare. Încearcă din nou.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="h-7 w-7 text-primary-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Verifică emailul</h2>
        <p className="text-sm text-gray-500">
          Am trimis un link de verificare la <strong>{email}</strong>. Accesează-l pentru a activa contul.
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
        <h1 className="text-2xl font-bold text-ink">Creează cont</h1>
        <p className="text-sm text-dim mt-1">Pornește trial-ul gratuit de 7 zile</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Nume complet"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          error={fieldErrors.name}
          autoComplete="name"
          required
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={fieldErrors.email}
          placeholder="tu@business.com"
          autoComplete="email"
          required
        />
        <div>
          <Input
            label="Parolă"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            error={fieldErrors.password}
            autoComplete="new-password"
            required
          />
          {password.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5">
              <PasswordRule met={rules.length} label="Minimum 8 caractere" />
              <PasswordRule met={rules.upper} label="Cel puțin o literă mare" />
              <PasswordRule met={rules.number} label="Cel puțin o cifră" />
            </ul>
          )}
        </div>
        <Input
          label="Confirmă parola"
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          error={fieldErrors.confirmPassword}
          autoComplete="new-password"
          required
        />

        {error && <Alert type="error" message={error} />}

        <Button type="submit" loading={loading} className="w-full mt-1">
          Creează cont gratuit
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Ai deja cont?{' '}
        <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
          Intră în cont
        </Link>
      </p>
    </>
  )
}
