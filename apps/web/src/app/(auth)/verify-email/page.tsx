'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api, ApiRequestError } from '@/lib/api'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

function VerifyEmailContent() {
  const params = useSearchParams()
  const token = params.get('token')
  // Stare inițială derivată din prezența token-ului (nu setState sincron în efect → react-hooks/set-state-in-effect).
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error')
  const [message, setMessage] = useState(token ? '' : 'Link invalid. Solicită un email nou de verificare.')

  useEffect(() => {
    if (!token) return
    api.auth.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(err => {
        setStatus('error')
        setMessage(err instanceof ApiRequestError ? err.message : 'Eroare la verificare.')
      })
  }, [token])

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <p className="text-sm text-gray-500">Se verifică emailul...</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="text-center">
        <CheckCircle2 className="h-12 w-12 text-primary-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Email verificat!</h2>
        <p className="text-sm text-gray-500 mb-6">Contul tău este activ. Poți intra acum.</p>
        <Link href="/login">
          <span className="inline-block bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
            Intră în cont
          </span>
        </Link>
      </div>
    )
  }

  return (
    <div className="text-center">
      <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Link invalid</h2>
      <p className="text-sm text-gray-500 mb-6">{message}</p>
      <Link href="/signup" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
        Creează un cont nou
      </Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center gap-3 py-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
