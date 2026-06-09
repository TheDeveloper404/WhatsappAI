'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

export function DeleteAccountButton() {
  const [confirm, setConfirm] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const accessToken = useAuthStore(s => s.accessToken)

  if (!accessToken) return null

  async function handleRequest() {
    if (!password) { setError('Introdu parola pentru a confirma.'); return }
    setLoading(true)
    setError('')
    try {
      await api.users.requestAccountDeletion(accessToken!, password)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A apărut o eroare.')
      setLoading(false)
    }
  }

  // După cerere: contul NU e șters încă. Userul trebuie să confirme din emailul primit.
  if (sent) {
    return (
      <div className="border border-line rounded-xl p-5 bg-cardhi">
        <p className="font-mono-ui text-[13px] text-ink mb-1">Verifică-ți emailul</p>
        <p className="font-mono-ui text-[12px] text-dim">
          Ți-am trimis un link de confirmare. Contul se șterge definitiv doar după ce apeși pe el.
          Link-ul expiră în 1 oră. Dacă te-ai răzgândit, ignoră emailul — contul rămâne neatins.
        </p>
      </div>
    )
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
        Îți trimitem un email de confirmare. Contul și toate datele tale vor fi șterse definitiv
        doar după ce apeși pe linkul din email. Această acțiune nu poate fi anulată.
      </p>
      <label className="block font-mono-ui text-[12px] text-dim mb-2">
        Confirmă cu parola ta:
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="parola"
          className="mt-1 w-full bg-cardhi border border-line rounded-lg px-3 py-2 font-mono-ui text-[13px] text-ink placeholder:text-dimmer focus:outline-hidden focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-colors"
        />
      </label>
      {error && <p className="font-mono-ui text-[12px] text-red-500 mb-3">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={handleRequest}
          disabled={loading || !password}
          className="font-mono-ui text-[12px] bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {loading ? 'se trimite...' : 'trimite linkul de ștergere'}
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
