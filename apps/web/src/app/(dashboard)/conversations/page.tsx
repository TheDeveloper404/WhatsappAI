'use client'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { api, type Conversation, type ConversationMessage } from '@/lib/api'
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
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 p-4 bg-white hover:bg-gray-50 transition-colors">
        <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
          <MessageSquare className="h-4 w-4 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">+{conv.contactPhone}</p>
          <p className="text-xs text-gray-400 truncate">{conv.lastMessage}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400">{formatTime(conv.lastAt)}</p>
          <p className="text-xs text-gray-300 mt-0.5">{conv.count} mesaje</p>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`p-1.5 rounded-lg transition-colors ${
              confirmDelete ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
            }`}
            title={confirmDelete ? 'Confirmă ștergerea' : 'Șterge istoricul'}
            onBlur={() => setTimeout(() => setConfirmDelete(false), 200)}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
          <button
            onClick={toggle}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Messages thread */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-2 max-h-80 overflow-y-auto">
          {loadingMsgs ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : messages && messages.length > 0 ? (
            messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-xl text-sm ${
                  msg.fromMe
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                }`}>
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  <p className={`text-xs mt-1 ${msg.fromMe ? 'text-primary-200' : 'text-gray-400'}`}>
                    {formatTime(msg.waTimestamp)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">Niciun mesaj salvat.</p>
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

  function handleDeleted(phone: string) {
    setConversations(prev => prev.filter(c => c.contactPhone !== phone))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conversații</h1>
          <p className="text-sm text-gray-500 mt-1">
            {conversations.length > 0
              ? `${conversations.length} contact${conversations.length !== 1 ? 'e' : ''} cu mesaje salvate`
              : 'Nicio conversație salvată încă.'}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="Reîncarcă"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <MessageSquare className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Agentul nu a salvat nicio conversație încă.</p>
          <p className="text-gray-400 text-xs mt-1">Mesajele apar aici după ce agentul începe să răspundă.</p>
        </div>
      ) : (
        <div className="space-y-3">
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
