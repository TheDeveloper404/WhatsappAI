'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { api, type WhatsappSession } from '@/lib/api'
import { QRCodeSVG } from 'qrcode.react'
import { Smartphone, Wifi, WifiOff, Loader2, ChevronRight, RefreshCw } from 'lucide-react'

function StatusBadge({ status }: { status: WhatsappSession['status'] }) {
  const map = {
    connected:    { text: 'Conectat',           color: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
    pairing:      { text: 'Aștept scanare…',    color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
    disconnected: { text: 'Deconectat',         color: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-400' },
  }
  const { text, color, dot } = map[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {text}
    </span>
  )
}

export default function ConnectPage() {
  const accessToken = useAuthStore(s => s.accessToken)
  const router = useRouter()

  const [session, setSession] = useState<WhatsappSession | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState('')

  // Poll session status
  useEffect(() => {
    if (!accessToken) return
    const intervalRef = { current: undefined as ReturnType<typeof setInterval> | undefined }

    async function fetchSession() {
      if (!accessToken) return
      try {
        const { session } = await api.whatsapp.getSession(accessToken)
        setSession(session)

        if (session?.status === 'pairing' && session.pairingCode) {
          setQrCode(session.pairingCode)
        }

        if (session?.status === 'connected') {
          clearInterval(intervalRef.current)
          setQrCode(null)
        }
      } catch {
        // ignorăm erorile tranzitorii
      }
    }

    fetchSession()
    intervalRef.current = setInterval(fetchSession, 3000)
    return () => clearInterval(intervalRef.current)
  }, [accessToken])

  async function handleConnect() {
    if (!accessToken) return
    setError('')
    setLoading(true)
    setQrCode(null)
    try {
      const { qrCode: code } = await api.whatsapp.connect(accessToken)
      setQrCode(code)
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Eroare la conectare.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!accessToken) return
    setDisconnecting(true)
    try {
      await api.whatsapp.disconnect(accessToken)
      setSession(null)
      setQrCode(null)
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Eroare la deconectare.')
    } finally {
      setDisconnecting(false)
    }
  }

  const isConnected = session?.status === 'connected'
  const isPairing = session?.status === 'pairing' || !!qrCode

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Conectare WhatsApp</h1>
        <p className="text-gray-500 mt-1">Scanează codul QR cu aplicația WhatsApp.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Status curent */}
        {session && (
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {session.phoneNumber ? `+${session.phoneNumber}` : 'Număr necunoscut'}
                </p>
                <StatusBadge status={session.status} />
              </div>
            </div>
            {(isConnected || isPairing) && (
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
              >
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <WifiOff className="h-4 w-4" />}
                Deconectează
              </button>
            )}
          </div>
        )}

        {/* Conectat */}
        {isConnected && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <Wifi className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-lg font-semibold text-gray-900">WhatsApp conectat!</p>
            <p className="text-sm text-gray-500">
              Agentul AI poate acum prelua conversațiile când ești indisponibil.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-2 flex items-center gap-1 text-sm text-primary-600 font-medium hover:underline"
            >
              Înapoi la dashboard <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* QR code */}
        {!isConnected && isPairing && qrCode && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-gray-600 text-center">
              Deschide WhatsApp → <strong>Dispozitive conectate</strong> → <strong>Conectează un dispozitiv</strong> → scanează codul
            </p>
            <div className="p-4 bg-white border-2 border-gray-200 rounded-xl">
              <QRCodeSVG value={qrCode} size={220} />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <RefreshCw className="h-3 w-3" />
              Codul se reîmprospătează automat la 20 de secunde
            </div>
            <p className="text-xs text-center text-gray-400">
              Această pagină se actualizează automat după scanare.
            </p>
          </div>
        )}

        {/* Loading QR */}
        {!isConnected && isPairing && !qrCode && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            <p className="text-sm text-gray-600">Se generează codul QR…</p>
          </div>
        )}

        {/* Neconectat — buton start */}
        {!isConnected && !isPairing && (
          <div className="flex flex-col items-center gap-4 py-4">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 w-full text-center">{error}</p>
            )}
            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Se conectează…</> : 'Generează cod QR'}
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      {!isConnected && (
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-700 mb-1">Cum funcționează?</p>
          <p className="text-xs text-blue-600">
            Apasă butonul, scanează QR-ul cu WhatsApp de pe telefon (Dispozitive conectate → Conectează un dispozitiv).
            Conexiunea persistă chiar și după repornirea serverului.
          </p>
        </div>
      )}
    </div>
  )
}
