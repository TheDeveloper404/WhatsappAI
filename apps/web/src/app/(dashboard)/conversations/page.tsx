'use client'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { api, API_URL, type Conversation, type ConversationMessage } from '@/lib/api'
import { Loader2, MessageSquare, ChevronDown, ChevronUp, Trash2, RefreshCw } from 'lucide-react'

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
}: {
  conv: Conversation
  accessToken: string
  onDeleted: (phone: string) => void
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
                  <p className="whitespace-pre-wrap break-words font-mono-ui text-[13px]">{msg.body}</p>
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
  const esRef = useRef<EventSource | null>(null)

  async function load(showRefresh = false) {
    if (!accessToken) return
    if (showRefresh) setRefreshing(true)
    try {
      const { conversations: convs } = await api.ai.getConversations(accessToken)
      setConversations(convs)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [accessToken])

  useEffect(() => {
    if (!accessToken) return
    const url = `${API_URL}/api/v1/ai/stream?token=${encodeURIComponent(accessToken)}`
    const es = new EventSource(url, { withCredentials: true })
    esRef.current = es

    es.onmessage = (e) => {
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

    return () => { es.close(); esRef.current = null }
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
    <div className="max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[32px] text-ink leading-none">Conversații</h1>
          <p className="font-mono-ui text-[13px] text-dim mt-1">
            {conversations.length > 0
              ? `${conversations.length} contact${conversations.length !== 1 ? 'e' : ''} cu mesaje salvate`
              : 'Nicio conversație salvată încă.'}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="p-2 text-dimmer hover:text-ink hover:bg-cardhi rounded-lg transition-colors disabled:opacity-50"
          title="Reîncarcă"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
