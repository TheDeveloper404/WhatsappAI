'use client'
import { Suspense, useState, useRef, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Turnstile } from '@/components/Turnstile'
import { api, ApiRequestError } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

function LoginContent() {
  const router = useRouter()
  const setAuth = useAuthStore(s => s.setAuth)
  // Query params știute și pe server → derivate în render (nu setState în efect). `useSearchParams`
  // cere o graniță Suspense (vezi `LoginPage` mai jos).
  const params = useSearchParams()
  const passwordReset = params.get('reset') === '1'
  const emailVerified = params.get('verified') === '1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)
  // Anti account-lockout DoS (0.7): după N login-uri eșuate, API-ul răspunde `CAPTCHA_REQUIRED`. Afișăm
  // widget-ul Turnstile, iar la următoarea încercare trimitem token-ul. Token-ul e single-use → după
  // fiecare încercare îl resetăm și remontăm widget-ul (bump pe `captchaKey`) ca să obținem unul proaspăt.
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const waitingForCaptcha = captchaRequired && !captchaToken

  async function doLogin() {
    setError('')
    setLoading(true)
    try {
      const { user, accessToken } = await api.auth.login({
        email,
        password,
        turnstileToken: captchaToken ?? undefined,
      })
      setAuth(user, accessToken)
      router.push('/dashboard')
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'CAPTCHA_REQUIRED') {
        setCaptchaRequired(true)
      } else {
        setError(err instanceof Error ? err.message : 'A apărut o eroare. Încearcă din nou.')
      }
      // Token-ul Turnstile e de unică folosință → după orice încercare cerem unul nou.
      setCaptchaToken(null)
      setCaptchaKey(k => k + 1)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await doLogin()
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
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); passwordRef.current?.focus() } }}
          placeholder="tu@business.ro"
          autoComplete="email"
          required
        />
        <Input
          label="Parolă"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !loading && !waitingForCaptcha) { e.preventDefault(); doLogin() } }}
          ref={passwordRef}
          autoComplete="current-password"
          required
        />

        <div className="flex justify-end -mt-1">
          <Link href="/forgot-password" className="font-mono-ui text-[11.5px] text-acid hover:opacity-75 transition-opacity">
            ai uitat parola?
          </Link>
        </div>

        {captchaRequired && (
          <div className="mt-1">
            <Alert
              type="info"
              message="Verificare de securitate după mai multe încercări. Așteaptă confirmarea, apoi apasă din nou."
              className="mb-3"
            />
            <Turnstile key={captchaKey} onToken={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
          </div>
        )}

        <Button type="submit" loading={loading} disabled={waitingForCaptcha} className="w-full mt-2 h-11 text-[14px]">
          {waitingForCaptcha ? 'verificare…' : 'intră în cont →'}
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
