'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { api, type WhatsappSession } from '@/lib/api'
import { QRCodeSVG } from 'qrcode.react'
import { Smartphone, Wifi, WifiOff, Loader2, ChevronRight, RefreshCw } from 'lucide-react'

function StatusBadge({ status }: { status: WhatsappSession['status'] }) {
  const map = {
    connected:    { text: 'Conectat',           color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',  dot: 'bg-green-500' },
    pairing:      { text: 'Aștept scanare…',    color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',  dot: 'bg-amber-500' },
    disconnected: { text: 'Deconectat',         color: 'bg-cardhi text-dim',                                                    dot: 'bg-dimmer' },
  }
  const { text, color, dot } = map[status]
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono-ui text-[11px] px-3 py-1.5 rounded-full ${color}`}>
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
  const [initialLoading, setInitialLoading] = useState(true)

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
      } finally {
        setInitialLoading(false)
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
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[32px] text-ink leading-none">Conectare WhatsApp</h1>
        <p className="font-mono-ui text-[12px] text-dim mt-1">Scanează codul QR cu aplicația WhatsApp.</p>
      </div>

      <div className="card-elevated rounded-xl p-6">
        {/* Status curent */}
        {session && (
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-line">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cardhi flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-dim" />
              </div>
              <div>
                <p className="font-mono-ui text-[12px] text-ink font-medium">
                  {session.phoneNumber ? `+${session.phoneNumber}` : 'Număr necunoscut'}
                </p>
                <StatusBadge status={session.status} />
              </div>
            </div>
            {(isConnected || isPairing) && (
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-1.5 font-mono-ui text-[12px] text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium transition-colors"
              >
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <WifiOff className="h-4 w-4" />}
                Deconectează
              </button>
            )}
          </div>
        )}

        {/* Loading inițial */}
        {initialLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-dim" />
          </div>
        )}

        {/* Conectat */}
        {!initialLoading && isConnected && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Wifi className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="font-display text-[24px] text-ink leading-none">WhatsApp conectat!</p>
            <p className="font-mono-ui text-[12px] text-dim">
              Agentul AI poate acum prelua conversațiile când ești indisponibil.
            </p>
            <button
              onClick={() => { router.refresh(); router.push('/dashboard') }}
              className="mt-2 flex items-center gap-1 font-mono-ui text-[12px] text-acid font-medium hover:underline"
            >
              Înapoi la dashboard <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* QR code */}
        {!initialLoading && !isConnected && isPairing && qrCode && (
          <div className="flex flex-col items-center gap-4">
            <p className="font-mono-ui text-[12px] text-dim text-center">
              Deschide WhatsApp → <strong className="text-ink">Dispozitive conectate</strong> → <strong className="text-ink">Conectează un dispozitiv</strong> → scanează codul
            </p>
            <div className="p-4 bg-white border-2 border-line rounded-xl">
              <QRCodeSVG value={qrCode} size={220} />
            </div>
            <div className="flex items-center gap-1.5 font-mono-ui text-[11px] text-amber-600 dark:text-amber-400">
              <RefreshCw className="h-3 w-3" />
              Codul se reîmprospătează automat la 20 de secunde
            </div>
            <p className="font-mono-ui text-[11px] text-dimmer text-center">
              Această pagină se actualizează automat după scanare.
            </p>
          </div>
        )}

        {/* Loading QR */}
        {!initialLoading && !isConnected && isPairing && !qrCode && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-acid" />
            <p className="font-mono-ui text-[12px] text-dim">Se generează codul QR…</p>
          </div>
        )}

        {/* Neconectat — buton start */}
        {!initialLoading && !isConnected && !isPairing && (
          <div className="flex flex-col items-center gap-4 py-4">
            {error && (
              <p className="font-mono-ui text-[12px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 w-full text-center">{error}</p>
            )}
            <button
              onClick={handleConnect}
              disabled={loading}
              style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
              className="w-full py-2.5 hover:opacity-90 disabled:opacity-50 font-mono-ui text-sm font-medium rounded-xl transition-opacity flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Se conectează…</> : 'Generează cod QR'}
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      {!isConnected && (
        <div className="mt-4 bg-cardhi border border-line rounded-xl p-4">
          <p className="font-mono-ui text-[10px] text-acid tracking-widest mb-1">Cum funcționează?</p>
          <p className="font-mono-ui text-[12px] text-dim">
            Apasă butonul, scanează QR-ul cu WhatsApp de pe telefon (Dispozitive conectate → Conectează un dispozitiv).
            Conexiunea persistă chiar și după repornirea serverului.
          </p>
        </div>
      )}
    </div>
  )
}
