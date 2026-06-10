'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { api, API_URL, type Conversation, type ConversationMessage } from '@/lib/api'
import { Loader2, MessageSquare, ChevronDown, ChevronUp, Trash2, RefreshCw, Download, Ban } from 'lucide-react'
import { ConversationsTabs } from '@/components/ConversationsTabs'

type ExportRow = { contactPhone: string; fromMe: boolean; isAi: boolean; body: string; waTimestamp: number }

// CSV propriu (zero deps, ca importul de catalog). Escaping RFC 4180: ghilimele/virgule/newline.
function conversationsToCsv(rows: ExportRow[]): string {
  const esc = (v: string) => {
    let s = String(v ?? '')
    // Anti CSV formula-injection: valorile care încep cu = + - @ tab CR pot fi executate ca formule
    // în Excel/LibreOffice, iar mesajul clientului (m.body) e necontrolat. Neutralizăm cu un apostrof în față.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const out = ['Telefon,Data,Expeditor,Mesaj']
  for (const m of rows) {
    const sender = m.fromMe ? (m.isAi ? 'Agent AI' : 'Proprietar') : 'Client'
    const date = new Date(m.waTimestamp).toLocaleString('ro-RO')
    out.push([esc('+' + m.contactPhone), esc(date), esc(sender), esc(m.body)].join(','))
  }
  return out.join('\r\n')
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
}

function ContactRow({
  conv,
  accessToken,
  onDeleted,
  skipped,
  onToggleSkip,
}: {
  conv: Conversation
  accessToken: string
  onDeleted: (phone: string) => void
  skipped: boolean
  onToggleSkip: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function loadMessages() {
    if (messages !== null) return
    setLoadingMsgs(true)
    try {
      const { messages: msgs } = await api.ai.getMessages(accessToken, conv.contactPhone)
      setMessages(msgs)
    } finally {
      setLoadingMsgs(false)
    }
  }

  function toggle() {
    if (!expanded) loadMessages()
    setExpanded(e => !e)
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await api.ai.clearConversation(accessToken, conv.contactPhone)
      onDeleted(conv.contactPhone)
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="border-b border-line last:border-0">
      {/* Header row */}
      <div className="flex items-center gap-4 py-4">
        <div className="w-10 h-10 rounded-full bg-acid/10 flex items-center justify-center shrink-0">
          <MessageSquare className="h-4 w-4 text-acid" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono-ui text-[14px] text-ink font-medium">+{conv.contactPhone}</p>
          <p className="font-mono-ui text-[12px] text-dimmer truncate mt-0.5">{conv.lastMessage}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono-ui text-[12px] text-dimmer">{formatTime(conv.lastAt)}</p>
          <p className="font-mono-ui text-[11px] text-dimmer mt-0.5">{conv.count} mesaje</p>
        </div>
        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={onToggleSkip}
            className={`p-1.5 rounded-lg transition-colors ${
              skipped
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                : 'text-dimmer hover:text-ink hover:bg-cardhi'
            }`}
            title={skipped ? 'AI ignoră acest contact — apasă pentru a reactiva' : 'Ignoră AI pentru acest contact'}
          >
            <Ban className="h-4 w-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`p-1.5 rounded-lg transition-colors ${
              confirmDelete
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                : 'text-dimmer hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
            }`}
            title={confirmDelete ? 'Confirmă ștergerea' : 'Șterge istoricul'}
            onBlur={() => setTimeout(() => setConfirmDelete(false), 200)}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
          <button
            onClick={toggle}
            className="p-1.5 text-dimmer hover:text-ink hover:bg-cardhi rounded-lg transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Messages thread */}
      {expanded && (
        <div className="pb-4 space-y-2 max-h-80 overflow-y-auto">
          {loadingMsgs ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-dimmer" />
            </div>
          ) : messages && messages.length > 0 ? (
            messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs lg:max-w-md px-3 py-2 rounded-xl ${
                    msg.fromMe
                      ? 'rounded-br-sm'
                      : 'bg-cardhi text-ink border border-line rounded-bl-sm'
                  }`}
                  style={msg.fromMe ? { background: 'var(--acid)', color: 'var(--on-acid)' } : undefined}
                >
                  <p className="whitespace-pre-wrap wrap-break-word font-mono-ui text-[13px]">{msg.body}</p>
                  <p className={`font-mono-ui text-[10px] mt-1 ${msg.fromMe ? 'opacity-70' : 'text-dimmer'}`}>
                    {formatTime(msg.waTimestamp)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="font-mono-ui text-[13px] text-dimmer text-center py-4">Niciun mesaj salvat.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function ConversationsPage() {
  const { accessToken } = useAuthStore()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const esRef = useRef<EventSource | null>(null)

  // Ignoră / reactivează AI pentru un contact (= blacklist după contactPhone, care e LID-ul sau numărul —
  // se potrivește mereu cu mesajele viitoare). Optimistic, cu revert la eroare.
  async function toggleSkip(phone: string) {
    if (!accessToken) return
    const isSkipped = skipped.has(phone)
    setSkipped(prev => {
      const next = new Set(prev)
      if (isSkipped) next.delete(phone); else next.add(phone)
      return next
    })
    try {
      if (isSkipped) await api.ai.removeBlacklist(accessToken, phone)
      else await api.ai.addBlacklist(accessToken, phone)
    } catch {
      setSkipped(prev => {
        const next = new Set(prev)
        if (isSkipped) next.add(phone); else next.delete(phone)
        return next
      })
    }
  }

  async function handleExport() {
    if (!accessToken || exporting) return
    setExporting(true)
    try {
      const { messages } = await api.ai.exportConversations(accessToken)
      // BOM (U+FEFF) ca Excel să afișeze corect diacriticele românești.
      const csv = String.fromCharCode(0xFEFF) + conversationsToCsv(messages)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `conversatii-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      // fail-soft: nu blocăm pagina; userul poate reîncerca
    } finally {
      setExporting(false)
    }
  }

  const load = useCallback(async (showRefresh = false) => {
    if (!accessToken) return
    if (showRefresh) setRefreshing(true)
    try {
      const [{ conversations: convs }, bl] = await Promise.all([
        api.ai.getConversations(accessToken),
        api.ai.getBlacklist(accessToken).catch(() => ({ phones: [] as string[] })),
      ])
      setConversations(convs)
      setSkipped(new Set(bl.phones))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [accessToken])

  // Fetch on mount. setState-urile din `load` sunt DUPĂ `await` (async), nu sincrone — regula e conservativă
  // pe funcția apelată și nu urmărește granița await. Disable documentat (vezi BACKLOG 0.5).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const handleMessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { contactPhone: string; lastMessage: string; lastAt: number; fromMe: boolean }
        setConversations(prev => {
          const idx = prev.findIndex(c => c.contactPhone === data.contactPhone)
          let next: Conversation[]
          if (idx !== -1) {
            next = [...prev]
            next[idx] = { ...next[idx], lastMessage: data.lastMessage, lastAt: data.lastAt, fromMe: data.fromMe, count: next[idx].count + 1 }
          } else {
            next = [{ contactPhone: data.contactPhone, lastMessage: data.lastMessage, lastAt: data.lastAt, fromMe: data.fromMe, count: 1 }, ...prev]
          }
          return next.sort((a, b) => b.lastAt - a.lastAt)
        })
      } catch {}
    }

    // Token-ul de stream e efemer (60s), deci NU ne bazăm pe auto-reconnect-ul nativ al EventSource
    // (ar refolosi un token expirat). La fiecare (re)conectare cerem un token proaspăt.
    async function connect() {
      if (cancelled) return
      try {
        const { token } = await api.ai.getStreamToken(accessToken!)
        if (cancelled) return
        const url = `${API_URL}/api/v1/ai/stream?token=${encodeURIComponent(token)}`
        const es = new EventSource(url, { withCredentials: true })
        esRef.current = es
        es.onmessage = handleMessage
        es.onerror = () => {
          // Conexiune pierdută / token expirat: închidem și reconectăm cu un token nou.
          es.close()
          if (esRef.current === es) esRef.current = null
          if (!cancelled) retryTimer = setTimeout(connect, 3000)
        }
      } catch {
        if (!cancelled) retryTimer = setTimeout(connect, 5000)
      }
    }
    connect()

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      esRef.current?.close()
      esRef.current = null
    }
  }, [accessToken])

  function handleDeleted(phone: string) {
    setConversations(prev => prev.filter(c => c.contactPhone !== phone))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-acid" />
      </div>
    )
  }

  return (
    <div>
      <ConversationsTabs />
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[32px] text-ink leading-none">Conversații</h1>
          <p className="font-mono-ui text-[13px] text-dim mt-1">
            {conversations.length > 0
              ? `${conversations.length} contact${conversations.length !== 1 ? 'e' : ''} cu mesaje salvate`
              : 'Nicio conversație salvată încă.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {conversations.length > 0 && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-dim hover:text-ink hover:bg-cardhi transition-colors disabled:opacity-50 font-mono-ui text-[12px]"
              title="Exportă conversațiile (CSV)"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span className="hidden sm:inline">Exportă</span>
            </button>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2 text-dimmer hover:text-ink hover:bg-cardhi rounded-lg transition-colors disabled:opacity-50"
            title="Reîncarcă"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="py-20 text-center">
          <MessageSquare className="h-10 w-10 text-dimmer mx-auto mb-3" />
          <p className="font-mono-ui text-[14px] text-dim">Agentul nu a salvat nicio conversație încă.</p>
          <p className="font-mono-ui text-[12px] text-dimmer mt-1">Mesajele apar aici după ce agentul începe să răspundă.</p>
        </div>
      ) : (
        <div>
          {conversations.map(conv => (
            <ContactRow
              key={conv.contactPhone}
              conv={conv}
              accessToken={accessToken!}
              onDeleted={handleDeleted}
              skipped={skipped.has(conv.contactPhone)}
              onToggleSkip={() => toggleSkip(conv.contactPhone)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
