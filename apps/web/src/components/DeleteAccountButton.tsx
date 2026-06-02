'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

export function DeleteAccountButton() {
  const [confirm, setConfirm] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const accessToken = useAuthStore(s => s.accessToken)
  const logout = useAuthStore(s => s.clearAuth)
  const router = useRouter()

  if (!accessToken) return null

  async function handleDelete() {
    if (!password) { setError('Introdu parola pentru a confirma.'); return }
    setLoading(true)
    setError('')
    try {
      await api.users.deleteAccount(accessToken!, password)
      logout()
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A apărut o eroare.')
      setLoading(false)
    }
  }

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="font-mono-ui text-[12px] text-red-500 hover:text-red-400 transition-colors underline underline-offset-2"
      >
        șterge contul meu
      </button>
    )
  }

  return (
    <div className="border border-red-500/30 rounded-xl p-5 bg-red-500/5">
      <p className="font-mono-ui text-[13px] text-ink mb-1">ești sigur?</p>
      <p className="font-mono-ui text-[12px] text-dim mb-4">
        Contul și toate datele tale vor fi șterse definitiv în <strong className="text-ink">48 de ore</strong>. Această acțiune nu poate fi anulată.
      </p>
      <label className="block font-mono-ui text-[12px] text-dim mb-2">
        Confirmă cu parola ta:
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="parola"
          className="mt-1 w-full bg-cardhi border border-line rounded-lg px-3 py-2 font-mono-ui text-[13px] text-ink placeholder:text-dimmer focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-colors"
        />
      </label>
      {error && <p className="font-mono-ui text-[12px] text-red-500 mb-3">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={handleDelete}
          disabled={loading || !password}
          className="font-mono-ui text-[12px] bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {loading ? 'se procesează...' : 'da, șterge contul'}
        </button>
        <button
          onClick={() => { setConfirm(false); setError(''); setPassword('') }}
          disabled={loading}
          className="font-mono-ui text-[12px] text-dim hover:text-ink transition-colors"
        >
          anulează
        </button>
      </div>
    </div>
  )
}
