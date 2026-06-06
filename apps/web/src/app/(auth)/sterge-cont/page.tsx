'use client'
import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { api, ApiRequestError } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Check, Loader2 } from 'lucide-react'

function StergeContContent() {
  const params = useSearchParams()
  const router = useRouter()
  const clearAuth = useAuthStore(s => s.clearAuth)
  const token = params.get('token')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Link invalid</h2>
        <p className="text-sm text-gray-500">Acest link de ștergere este invalid sau a expirat.</p>
      </div>
    )
  }

  async function handleConfirm() {
    setError('')
    setLoading(true)
    try {
      await api.users.confirmAccountDeletion(token!)
      clearAuth()
      setDone(true)
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.message)
      else setError('A apărut o eroare. Încearcă din nou.')
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <Check className="h-6 w-6 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Cont șters</h2>
        <p className="text-sm text-gray-500 mb-4">
          Contul tău și toate datele asociate au fost șterse definitiv. Ne pare rău că pleci.
        </p>
        <Link href="/" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
          Înapoi la pagina principală
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Confirmă ștergerea contului</h1>
        <p className="text-sm text-gray-500 mt-1">
          Contul și toate datele tale (conversații, produse, comenzi, conexiunea WhatsApp) vor fi
          șterse <strong>definitiv și ireversibil</strong>.
        </p>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      <div className="flex flex-col gap-3">
        <Button onClick={handleConfirm} loading={loading} variant="danger" className="w-full">
          Da, șterge contul definitiv
        </Button>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-gray-500 hover:text-gray-700 font-medium"
        >
          Anulează, păstrează contul
        </button>
      </div>
    </>
  )
}

export default function StergeContPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    }>
      <StergeContContent />
    </Suspense>
  )
}
