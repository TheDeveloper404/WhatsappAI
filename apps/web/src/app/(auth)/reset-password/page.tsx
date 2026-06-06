'use client'
import { Suspense, useState, FormEvent } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { api, ApiRequestError } from '@/lib/api'
import { Check, Loader2 } from 'lucide-react'

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${met ? 'text-green-600' : 'text-gray-400'}`}>
      {met ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-current inline-block" />}
      {label}
    </li>
  )
}

function ResetPasswordContent() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [loading, setLoading] = useState(false)

  const rules = { length: password.length >= 8, upper: /[A-Z]/.test(password), number: /[0-9]/.test(password) }

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Link invalid</h2>
        <p className="text-sm text-gray-500 mb-4">Acest link de resetare este invalid sau a expirat.</p>
        <Link href="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
          Solicită un link nou
        </Link>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setFieldError('')
    if (password !== confirmPassword) { setFieldError('Parolele nu se potrivesc.'); return }
    setLoading(true)
    try {
      await api.auth.resetPassword(token!, password)
      router.push('/login?reset=1')
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.message)
      else setError('A apărut o eroare. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Parolă nouă</h1>
        <p className="text-sm text-gray-500 mt-1">Alege o parolă sigură pentru contul tău</p>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <Input
            label="Parolă nouă"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
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
          error={fieldError}
          autoComplete="new-password"
          required
        />
        <Button type="submit" loading={loading} className="w-full mt-1">
          Setează parola nouă
        </Button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
