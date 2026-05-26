'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Loader2, Eye, EyeOff } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function AdminLoginPage() {
  const router = useRouter()
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      })
      if (!res.ok) {
        setError('Cod de acces incorect.')
        return
      }
      sessionStorage.setItem('admin_token', secret)
      router.push('/admin/dashboard')
    } catch {
      setError('Eroare de conexiune. Verifică serverul.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary-200">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Admin Panel</h1>
          <p className="text-gray-500 text-sm mt-2">Acces restricționat — doar administratori</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-7">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Cod secret
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  placeholder="Introdu codul de acces"
                  autoFocus
                  className="w-full border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-11 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !secret.trim()}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Se verifică...
                </>
              ) : (
                'Intră în admin'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-400 text-xs mt-8">
          WhatsApp AI · Panou administrare intern
        </p>
      </div>
    </div>
  )
}
