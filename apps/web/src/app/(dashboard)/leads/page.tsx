'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { api, type Lead, type LeadStatus } from '@/lib/api'
import { Loader2, Flame, RefreshCw } from 'lucide-react'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const STATUS_META: Record<LeadStatus, { label: string; color: string; dot: string }> = {
  hot:  { label: 'Hot',  color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',         dot: 'bg-red-500' },
  warm: { label: 'Warm', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  cold: { label: 'Cold', color: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',         dot: 'bg-sky-500' },
}

const FILTERS: { id: 'all' | LeadStatus; label: string }[] = [
  { id: 'all',  label: 'Toate' },
  { id: 'hot',  label: 'Hot' },
  { id: 'warm', label: 'Warm' },
  { id: 'cold', label: 'Cold' },
]

export default function LeadsPage() {
  const { accessToken } = useAuthStore()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | LeadStatus>('all')
  const [analyzingAll, setAnalyzingAll] = useState(false)
  const [analyzingPhone, setAnalyzingPhone] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      const { leads: l } = await api.ai.getLeads(accessToken)
      setLeads(l)
    } catch {
      setError('Nu s-au putut încărca lead-urile.')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    load()
  }, [load])

  async function handleAnalyzeAll() {
    if (!accessToken) return
    setAnalyzingAll(true); setError(null)
    try {
      await api.ai.analyzeLeads(accessToken)
      await load()
    } catch {
      setError('Eroare la recalcularea lead-urilor. Încearcă din nou într-un minut.')
    } finally {
      setAnalyzingAll(false)
    }
  }

  async function handleAnalyzeOne(phone: string) {
    if (!accessToken) return
    setAnalyzingPhone(phone); setError(null)
    try {
      await api.ai.analyzeLeads(accessToken, phone)
      await load()
    } catch {
      setError('Eroare la recalcularea acestui lead.')
    } finally {
      setAnalyzingPhone(null)
    }
  }

  const visible = filter === 'all' ? leads : leads.filter(l => l.status === filter)
  const hotCount = leads.filter(l => l.status === 'hot').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-acid" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] text-ink leading-none">Lead-uri</h1>
          <p className="font-mono-ui text-[13px] text-dim mt-1">
            Contactele tale, clasificate după interesul de cumpărare.{hotCount > 0 && <span className="text-red-600 dark:text-red-400"> {hotCount} hot.</span>}
          </p>
        </div>
        <button
          onClick={handleAnalyzeAll}
          disabled={analyzingAll}
          style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
          className="flex items-center justify-center gap-2 font-mono-ui text-[13px] px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity sm:shrink-0"
        >
          {analyzingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {analyzingAll ? 'Se analizează…' : 'Recalculează scoruri'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 font-mono-ui text-[13px] text-red-700 dark:text-red-300 mb-6">{error}</div>
      )}

      {/* Filtre */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`font-mono-ui text-[12px] px-3 py-1.5 rounded-full transition-colors ${
              filter === id ? 'bg-ink text-base' : 'bg-cardhi text-dim hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="border border-dashed border-line rounded-xl py-16 flex flex-col items-center gap-3">
          <Flame className="h-8 w-8 text-dimmer" />
          <p className="font-mono-ui text-[13px] text-dimmer">
            {leads.length === 0 ? 'Niciun contact încă.' : 'Niciun lead cu acest status.'}
          </p>
          {leads.length > 0 && filter === 'all' && (
            <p className="font-mono-ui text-[12px] text-dimmer">Apasă „Recalculează scoruri” pentru a clasifica contactele.</p>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map(lead => {
            const meta = lead.status ? STATUS_META[lead.status] : null
            return (
              <li key={lead.contactPhone} className="border border-line rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="min-w-0">
                    <p className="font-mono-ui text-[14px] text-ink font-medium">+{lead.contactPhone}</p>
                    <p className="font-mono-ui text-[11px] text-dimmer mt-0.5">
                      {lead.count} mesaje · ultimul {formatDate(lead.lastAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {meta ? (
                      <span className={`font-mono-ui text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5 ${meta.color}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {meta.label} · {lead.score}
                      </span>
                    ) : (
                      <span className="font-mono-ui text-[11px] px-3 py-1 rounded-full bg-cardhi text-dimmer">neanalizat</span>
                    )}
                  </div>
                </div>

                {lead.reason && (
                  <p className="font-mono-ui text-[12px] text-dim bg-cardhi/60 rounded-lg px-3 py-2 mb-3">{lead.reason}</p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-line">
                  <p className="font-mono-ui text-[12px] text-dimmer truncate max-w-[60%]">{lead.lastMessage}</p>
                  <button
                    onClick={() => handleAnalyzeOne(lead.contactPhone)}
                    disabled={analyzingPhone === lead.contactPhone}
                    className="flex items-center gap-1.5 font-mono-ui text-[12px] text-dim hover:text-ink transition-colors disabled:opacity-50 shrink-0"
                  >
                    {analyzingPhone === lead.contactPhone
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />}
                    Recalculează
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
