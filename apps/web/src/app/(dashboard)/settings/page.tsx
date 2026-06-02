'use client'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { api, type AiSettings, type WhatsappSession, type KnowledgeDocument } from '@/lib/api'
import { CURRENCIES, currencyLabel } from '@/lib/format'
import { Loader2, Save, Plus, X, Bot, Clock, Shield, Terminal, Flame, FileText, Upload, Trash2 } from 'lucide-react'

const inputCls = 'w-full rounded-xl border border-line px-3 py-2.5 text-[13px] text-ink bg-cardhi focus:outline-none focus:ring-2 focus:ring-acid/40 focus:border-acid transition-colors resize-y'

const TABS = [
  { id: 'agent', label: 'Agent', icon: Bot },
  { id: 'continut', label: 'Conținut', icon: Terminal },
  { id: 'control', label: 'Control', icon: Shield },
] as const

type Tab = typeof TABS[number]['id']

export default function SettingsPage() {
  const { accessToken } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('agent')
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [knowledgeBase, setKnowledgeBase] = useState('')
  const [writingStyle, setWritingStyle] = useState('')
  const [leadCriteria, setLeadCriteria] = useState('')
  const [orderIntakePrompt, setOrderIntakePrompt] = useState('')
  const [currency, setCurrency] = useState('RON')
  const [savingStyle, setSavingStyle] = useState(false)
  const [savedStyle, setSavedStyle] = useState(false)
  const [analyzingStyle, setAnalyzingStyle] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState(5)
  const [loading, setLoading] = useState(true)
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [savingKB, setSavingKB] = useState(false)
  const [savedKB, setSavedKB] = useState(false)
  const [savingTimer, setSavingTimer] = useState(false)
  const [savingLead, setSavingLead] = useState(false)
  const [savedLead, setSavedLead] = useState(false)
  const [savingIntake, setSavingIntake] = useState(false)
  const [savedIntake, setSavedIntake] = useState(false)
  const [savingCurrency, setSavingCurrency] = useState(false)
  const [savedCurrency, setSavedCurrency] = useState(false)
  const [togglingAI, setTogglingAI] = useState(false)
  const [savedPrompt, setSavedPrompt] = useState(false)
  const [savedTimer, setSavedTimer] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [waSession, setWaSession] = useState<WhatsappSession | null>(null)
  const [blacklist, setBlacklist] = useState<string[]>([])
  const [newPhone, setNewPhone] = useState('')
  const [addingPhone, setAddingPhone] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [docError, setDocError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!accessToken) return
    Promise.all([
      api.ai.getSettings(accessToken),
      api.ai.getBlacklist(accessToken),
      api.whatsapp.getSession(accessToken).catch(() => ({ session: null })),
      api.knowledge.list(accessToken).catch(() => ({ documents: [] })),
    ])
      .then(([{ settings: s }, { phones }, { session }, { documents: docs }]) => {
        setSettings(s)
        setSystemPrompt(s.systemPrompt)
        setKnowledgeBase(s.knowledgeBase ?? '')
        setWritingStyle(s.writingStyle ?? '')
        setLeadCriteria(s.leadCriteria ?? '')
        setOrderIntakePrompt(s.orderIntakePrompt ?? '')
        setCurrency(s.currency ?? 'RON')
        setTimerMinutes(s.timerMinutes)
        setBlacklist(phones)
        setWaSession(session)
        setDocuments(docs)
      })
      .catch(() => setError('Nu s-au putut încărca setările.'))
      .finally(() => setLoading(false))
  }, [accessToken])

  async function handleToggleAI() {
    if (!accessToken || !settings || settings.adminDisabled) return
    setTogglingAI(true)
    setError(null)
    try {
      const { settings: updated } = await api.ai.updateSettings(accessToken, { isActive: !settings.isActive })
      setSettings(updated)
    } catch {
      setError('Eroare la schimbarea stării agentului.')
    } finally {
      setTogglingAI(false)
    }
  }

  async function handleSavePrompt() {
    if (!accessToken) return
    setSavingPrompt(true); setSavedPrompt(false); setError(null)
    try {
      const { settings: updated } = await api.ai.updateSettings(accessToken, { systemPrompt })
      setSettings(updated); setSavedPrompt(true)
      setTimeout(() => setSavedPrompt(false), 3000)
    } catch { setError('Eroare la salvarea promptului.') }
    finally { setSavingPrompt(false) }
  }

  async function handleSaveTimer() {
    if (!accessToken) return
    setSavingTimer(true); setSavedTimer(false); setError(null)
    try {
      const { settings: updated } = await api.ai.updateSettings(accessToken, { timerMinutes })
      setSettings(updated); setSavedTimer(true)
      setTimeout(() => setSavedTimer(false), 3000)
    } catch { setError('Eroare la salvarea timerului.') }
    finally { setSavingTimer(false) }
  }

  async function handleSaveCurrency() {
    if (!accessToken) return
    setSavingCurrency(true); setSavedCurrency(false); setError(null)
    try {
      const { settings: updated } = await api.ai.updateSettings(accessToken, { currency })
      setSettings(updated); setSavedCurrency(true)
      setTimeout(() => setSavedCurrency(false), 3000)
    } catch { setError('Eroare la salvarea monedei.') }
    finally { setSavingCurrency(false) }
  }

  async function handleAnalyzeStyle() {
    if (!accessToken) return
    setAnalyzingStyle(true); setError(null)
    try {
      const { writingStyle: detected } = await api.ai.analyzeStyle(accessToken)
      setWritingStyle(detected)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la analiză. Asigură-te că ai cel puțin 5 mesaje trimise.')
    } finally { setAnalyzingStyle(false) }
  }

  async function handleSaveStyle() {
    if (!accessToken) return
    setSavingStyle(true); setSavedStyle(false); setError(null)
    try {
      const { settings: updated } = await api.ai.updateSettings(accessToken, { writingStyle })
      setSettings(updated); setSavedStyle(true)
      setTimeout(() => setSavedStyle(false), 3000)
    } catch { setError('Eroare la salvarea stilului.') }
    finally { setSavingStyle(false) }
  }

  async function handleSaveKB() {
    if (!accessToken) return
    setSavingKB(true); setSavedKB(false); setError(null)
    try {
      const { settings: updated } = await api.ai.updateSettings(accessToken, { knowledgeBase })
      setSettings(updated); setSavedKB(true)
      setTimeout(() => setSavedKB(false), 3000)
    } catch { setError('Eroare la salvarea informațiilor.') }
    finally { setSavingKB(false) }
  }

  async function handleSaveLead() {
    if (!accessToken) return
    setSavingLead(true); setSavedLead(false); setError(null)
    try {
      const { settings: updated } = await api.ai.updateSettings(accessToken, { leadCriteria })
      setSettings(updated); setSavedLead(true)
      setTimeout(() => setSavedLead(false), 3000)
    } catch { setError('Eroare la salvarea criteriilor.') }
    finally { setSavingLead(false) }
  }

  async function handleUploadDoc(file: File) {
    if (!accessToken) return
    setUploadingDoc(true); setDocError(null)
    try {
      const { document } = await api.knowledge.upload(accessToken, file)
      setDocuments(prev => [document, ...prev])
    } catch (err: unknown) {
      setDocError((err as { message?: string })?.message ?? 'Eroare la încărcarea documentului.')
    } finally {
      setUploadingDoc(false)
      if (fileInputRef.current) fileInputRef.current.value = '' // permite re-upload același fișier
    }
  }

  async function handleDeleteDoc(id: string) {
    if (!accessToken) return
    setDeletingDocId(id); setDocError(null)
    try {
      await api.knowledge.remove(accessToken, id)
      setDocuments(prev => prev.filter(d => d.id !== id))
    } catch {
      setDocError('Eroare la ștergerea documentului.')
    } finally {
      setDeletingDocId(null)
    }
  }

  async function handleSaveIntake() {
    if (!accessToken) return
    setSavingIntake(true); setSavedIntake(false); setError(null)
    try {
      const { settings: updated } = await api.ai.updateSettings(accessToken, { orderIntakePrompt })
      setSettings(updated); setSavedIntake(true)
      setTimeout(() => setSavedIntake(false), 3000)
    } catch { setError('Eroare la salvarea instrucțiunilor de comandă.') }
    finally { setSavingIntake(false) }
  }

  async function handleAddPhone() {
    if (!accessToken || !newPhone.trim()) return
    const cleaned = newPhone.replace(/[^0-9]/g, '')
    if (cleaned.length < 7) { setPhoneError('Număr prea scurt — minim 7 cifre.'); return }
    setAddingPhone(true); setPhoneError(null)
    try {
      await api.ai.addBlacklist(accessToken, cleaned)
      setBlacklist(prev => [...prev, cleaned]); setNewPhone('')
    } catch { setPhoneError('Eroare la adăugare. Încearcă din nou.') }
    finally { setAddingPhone(false) }
  }

  async function handleRemovePhone(phone: string) {
    if (!accessToken) return
    try {
      await api.ai.removeBlacklist(accessToken, phone)
      setBlacklist(prev => prev.filter(p => p !== phone))
    } catch { setError('Eroare la ștergerea numărului.') }
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
      <div className="mb-8">
        <h1 className="font-display text-[32px] text-ink leading-none">Setări Agent AI</h1>
        <p className="font-mono-ui text-[13px] text-dim mt-1">Configurează comportamentul agentului tău.</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 font-mono-ui text-[13px] text-red-700 dark:text-red-300 mb-6">{error}</div>
      )}

      {/* Tabs — underline style */}
      <div className="flex border-b border-line mb-8">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-3 font-mono-ui text-[13px] font-medium transition-all border-b-2 -mb-px ${
              activeTab === id
                ? 'text-ink border-acid'
                : 'text-dimmer hover:text-dim border-transparent'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Agent */}
      {activeTab === 'agent' && (
        <div className="divide-y divide-[var(--line)]">

          {/* Stare agent */}
          <div className="pb-7">
            <div className="flex items-center gap-2 mb-5">
              <Bot className="h-4 w-4 text-dimmer" />
              <p className="font-mono-ui text-[11px] text-dimmer uppercase tracking-widest">Stare agent</p>
            </div>

            {settings?.adminDisabled ? (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 font-mono-ui text-[13px] text-orange-800 dark:text-orange-300">
                Agentul a fost dezactivat de administrator. Contactează suportul pentru reactivare.
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-[var(--line)]">
                <div className="flex items-center justify-between pb-5">
                  <div>
                    <p className="font-mono-ui text-[14px] text-ink font-medium">
                      {settings?.isActive ? 'Agentul este activ' : 'Agentul este inactiv'}
                    </p>
                    <p className="font-mono-ui text-[12px] text-dim mt-1">
                      {settings?.isActive
                        ? 'Răspunde automat când ești indisponibil.'
                        : 'Nu răspunde la mesaje automat.'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleAI}
                    disabled={togglingAI}
                    style={settings?.isActive ? { background: 'var(--acid)' } : undefined}
                    className={`relative inline-flex h-6 w-11 shrink-0 ml-6 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                      settings?.isActive ? '' : 'bg-cardhi border border-line'
                    }`}
                  >
                    {togglingAI
                      ? <Loader2 className="h-3 w-3 animate-spin text-white absolute left-1/2 -translate-x-1/2" />
                      : <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${settings?.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    }
                  </button>
                </div>

                <div className="flex items-center justify-between py-5">
                  <div>
                    <p className="font-mono-ui text-[14px] text-ink font-medium">Notificare când AI preia</p>
                    <p className="font-mono-ui text-[12px] text-dim mt-1">Primești un mesaj pe WhatsApp când AI răspunde în locul tău.</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!accessToken || !settings) return
                      const { settings: updated } = await api.ai.updateSettings(accessToken, { notifyOnAiTakeover: !settings.notifyOnAiTakeover })
                      setSettings(updated)
                    }}
                    style={settings?.notifyOnAiTakeover ? { background: 'var(--acid)' } : undefined}
                    className={`relative inline-flex h-6 w-11 shrink-0 ml-6 items-center rounded-full transition-colors focus:outline-none ${
                      settings?.notifyOnAiTakeover ? '' : 'bg-cardhi border border-line'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${settings?.notifyOnAiTakeover ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            )}

            {settings?.isActive && waSession?.status !== 'connected' && (
              <div className="mt-4 rounded-lg px-4 py-3 font-mono-ui text-[12px] text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                Agentul e activ dar WhatsApp nu este conectat — mesajele nu vor primi răspuns.{' '}
                <a href="/dashboard" className="underline underline-offset-2">Conectează de pe Dashboard</a>
              </div>
            )}
          </div>

          {/* Timer */}
          <div className="py-7">
            <div className="flex items-center gap-2 mb-5">
              <Clock className="h-4 w-4 text-dimmer" />
              <p className="font-mono-ui text-[11px] text-dimmer uppercase tracking-widest">Timer inactivitate</p>
            </div>
            <p className="font-mono-ui text-[13px] text-dim mb-5">
              Agentul răspunde automat după câte minute de inactivitate din partea ta.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="number"
                min={1}
                max={60}
                value={timerMinutes}
                onChange={e => setTimerMinutes(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                className="w-20 rounded-xl border border-line px-3 py-2.5 text-[13px] text-ink bg-cardhi text-center focus:outline-none focus:ring-2 focus:ring-acid/40 focus:border-acid transition-colors"
              />
              <span className="font-mono-ui text-[13px] text-dim">minute (1–60)</span>
              <button
                onClick={handleSaveTimer}
                disabled={savingTimer}
                style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
                className="ml-auto flex items-center gap-2 font-mono-ui text-[13px] px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {savingTimer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvează
              </button>
              {savedTimer && <span className="font-mono-ui text-[12px] text-green-600 dark:text-green-400 font-medium">Salvat!</span>}
            </div>
          </div>

          {/* Monedă */}
          <div className="py-7">
            <div className="flex items-center gap-2 mb-5">
              <p className="font-mono-ui text-[11px] text-dimmer uppercase tracking-widest">Monedă</p>
            </div>
            <p className="font-mono-ui text-[13px] text-dim mb-5">
              Moneda folosită în catalog și comenzi. Se aplică la afișarea prețurilor; nu face conversie valutară.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-40 rounded-xl border border-line px-3 py-2.5 text-[13px] text-ink bg-cardhi focus:outline-none focus:ring-2 focus:ring-acid/40 focus:border-acid transition-colors"
              >
                {CURRENCIES.map(c => (
                  <option key={c} value={c}>{c} ({currencyLabel(c)})</option>
                ))}
              </select>
              <button
                onClick={handleSaveCurrency}
                disabled={savingCurrency}
                style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
                className="ml-auto flex items-center gap-2 font-mono-ui text-[13px] px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {savingCurrency ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvează
              </button>
              {savedCurrency && <span className="font-mono-ui text-[12px] text-green-600 dark:text-green-400 font-medium">Salvat!</span>}
            </div>
          </div>

        </div>
      )}

      {/* Tab: Conținut */}
      {activeTab === 'continut' && (
        <div className="divide-y divide-[var(--line)]">

          {/* System prompt */}
          <div className="pb-7">
            <p className="font-mono-ui text-[14px] text-ink font-medium mb-1">System prompt</p>
            <p className="font-mono-ui text-[13px] text-dim mb-4">
              Descrie cum să se comporte agentul: ton, limbă, instrucțiuni speciale.
            </p>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              rows={8}
              className={`${inputCls} font-mono`}
              placeholder="Ești un asistent WhatsApp helpful..."
            />
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSavePrompt}
                disabled={savingPrompt || systemPrompt === settings?.systemPrompt}
                style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
                className="flex items-center gap-2 font-mono-ui text-[13px] px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {savingPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvează promptul
              </button>
              {savedPrompt && <span className="font-mono-ui text-[12px] text-green-600 dark:text-green-400 font-medium">Salvat!</span>}
            </div>
          </div>

          {/* Stil scriere */}
          <div className="py-7">
            <div className="flex items-start justify-between mb-1">
              <p className="font-mono-ui text-[14px] text-ink font-medium">Stilul meu de scriere</p>
              <button
                onClick={handleAnalyzeStyle}
                disabled={analyzingStyle}
                className="flex items-center gap-2 font-mono-ui text-[13px] text-acid hover:underline disabled:opacity-50 shrink-0 ml-4"
              >
                {analyzingStyle ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {analyzingStyle ? 'Analizez...' : 'Analizează automat'}
              </button>
            </div>
            <p className="font-mono-ui text-[13px] text-dim mb-4">
              Agentul va imita stilul tău de comunicare. Apasă &ldquo;Analizează automat&rdquo; pentru a detecta stilul din istoricul conversațiilor, sau scrie manual.
            </p>
            <textarea
              value={writingStyle}
              onChange={e => setWritingStyle(e.target.value)}
              rows={4}
              className={inputCls}
              placeholder="Ex: Scriu scurt și direct, fără formule de politețe exagerate. Folosesc uneori emoji 😊."
            />
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSaveStyle}
                disabled={savingStyle || writingStyle === (settings?.writingStyle ?? '')}
                style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
                className="flex items-center gap-2 font-mono-ui text-[13px] px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {savingStyle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvează stilul
              </button>
              {savedStyle && <span className="font-mono-ui text-[12px] text-green-600 dark:text-green-400 font-medium">Salvat!</span>}
            </div>
          </div>

          {/* Knowledge base */}
          <div className="py-7">
            <p className="font-mono-ui text-[14px] text-ink font-medium mb-1">Informații despre business</p>
            <p className="font-mono-ui text-[13px] text-dim mb-4">
              Servicii, produse sau orice informație pe care agentul trebuie să o cunoască.
            </p>
            <textarea
              value={knowledgeBase}
              onChange={e => setKnowledgeBase(e.target.value)}
              rows={6}
              className={inputCls}
              placeholder={'Exemplu:\n\nServicii oferite:\n- Creare site WordPress\n- Aplicații web custom\n\nProgram: Luni–Vineri 09:00–17:00'}
            />
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSaveKB}
                disabled={savingKB || knowledgeBase === (settings?.knowledgeBase ?? '')}
                style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
                className="flex items-center gap-2 font-mono-ui text-[13px] px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {savingKB ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvează informațiile
              </button>
              {savedKB && <span className="font-mono-ui text-[12px] text-green-600 dark:text-green-400 font-medium">Salvat!</span>}
            </div>
          </div>

          {/* Documente (bază de cunoștințe RAG) */}
          <div className="py-7">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-dimmer" />
              <p className="font-mono-ui text-[14px] text-ink font-medium">Documente (bază de cunoștințe)</p>
            </div>
            <p className="font-mono-ui text-[13px] text-dim mb-4">
              Încarcă PDF, DOCX sau TXT (max 10 MB). Agentul caută automat în ele și răspunde clienților pe baza conținutului relevant.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleUploadDoc(file)
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingDoc}
              className="flex items-center gap-2 font-mono-ui text-[13px] px-4 py-2.5 rounded-lg border border-line text-ink hover:bg-cardhi disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploadingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploadingDoc ? 'Se procesează…' : 'Încarcă document'}
            </button>

            {docError && <p className="font-mono-ui text-[12px] text-red-500 mt-3">{docError}</p>}

            {documents.length > 0 && (
              <ul className="mt-4 space-y-2">
                {documents.map(doc => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 border border-line rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="h-4 w-4 text-dimmer shrink-0" />
                      <span className="font-mono-ui text-[13px] text-ink truncate">{doc.filename}</span>
                      <span className="font-mono-ui text-[11px] text-dimmer shrink-0">{(doc.charCount / 1000).toFixed(1)}k caractere</span>
                    </div>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      disabled={deletingDocId === doc.id}
                      className="p-1.5 text-dimmer hover:text-red-500 disabled:opacity-50 transition-colors shrink-0"
                      aria-label="Șterge documentul"
                    >
                      {deletingDocId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Criterii lead-uri */}
          <div className="py-7">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-4 w-4 text-dimmer" />
              <p className="font-mono-ui text-[14px] text-ink font-medium">Criterii calificare lead-uri</p>
            </div>
            <p className="font-mono-ui text-[13px] text-dim mb-4">
              Ce înseamnă un client potențial bun pentru tine. Folosit la scorarea din pagina „Lead-uri”. Gol = criterii generice.
            </p>
            <textarea
              value={leadCriteria}
              onChange={e => setLeadCriteria(e.target.value)}
              rows={4}
              className={inputCls}
              placeholder="ex: Un lead bun întreabă de preț sau disponibilitate, vrea programare, sau menționează un buget. Un lead slab doar întreabă lucruri generale."
            />
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSaveLead}
                disabled={savingLead || leadCriteria === (settings?.leadCriteria ?? '')}
                style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
                className="flex items-center gap-2 font-mono-ui text-[13px] px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {savingLead ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvează criteriile
              </button>
              {savedLead && <span className="font-mono-ui text-[12px] text-green-600 dark:text-green-400 font-medium">Salvat!</span>}
            </div>
          </div>

          {/* Instrucțiuni colectare comandă */}
          <div className="py-7">
            <div className="flex items-center gap-2 mb-1">
              <Terminal className="h-4 w-4 text-dimmer" />
              <p className="font-mono-ui text-[14px] text-ink font-medium">Instrucțiuni colectare comandă</p>
            </div>
            <p className="font-mono-ui text-[13px] text-dim mb-4">
              Ce informații trebuie să strângă agentul înainte de a propune o comandă. Agentul le cere pe rând,
              firesc, și nu finalizează până nu le are. Gol = colectare generică (produs + cantitate).
            </p>
            <textarea
              value={orderIntakePrompt}
              onChange={e => setOrderIntakePrompt(e.target.value)}
              rows={5}
              className={inputCls}
              placeholder={'Ex. (optică): pentru lentile cere SPH/CYL/AX pentru fiecare ochi, materialul și tratamentul.\nEx. (pizzerie): cere adresa de livrare și ora dorită.'}
            />
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSaveIntake}
                disabled={savingIntake || orderIntakePrompt === (settings?.orderIntakePrompt ?? '')}
                style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
                className="flex items-center gap-2 font-mono-ui text-[13px] px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {savingIntake ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvează instrucțiunile
              </button>
              {savedIntake && <span className="font-mono-ui text-[12px] text-green-600 dark:text-green-400 font-medium">Salvat!</span>}
            </div>
          </div>

        </div>
      )}

      {/* Tab: Control */}
      {activeTab === 'control' && (
        <div className="divide-y divide-[var(--line)]">

          {/* Comenzi WhatsApp */}
          <div className="pb-7">
            <div className="flex items-center gap-2 mb-5">
              <Terminal className="h-4 w-4 text-dimmer" />
              <p className="font-mono-ui text-[11px] text-dimmer uppercase tracking-widest">Comenzi WhatsApp</p>
            </div>
            <p className="font-mono-ui text-[13px] text-dim mb-5">
              Trimite aceste comenzi de pe numărul tău conectat direct în WhatsApp pentru a controla agentul în timp real.
            </p>
            <div className="divide-y divide-[var(--line)]">
              {([
                { cmd: '/activateAI', desc: 'Activează agentul' },
                { cmd: '/deactivateAI', desc: 'Dezactivează agentul' },
                { cmd: '/pauseAI 2h', desc: 'Pauză X ore — înlocuiește 2 cu numărul dorit' },
                { cmd: '/resumeAI', desc: 'Scoate agentul din pauză' },
                { cmd: '/setTimer 5min', desc: 'Setează timer-ul de inactivitate (1–60 min)' },
                { cmd: '/status', desc: 'Verifică starea curentă a agentului' },
                { cmd: '/clearHistory', desc: 'Șterge istoricul conversației curente cu un contact' },
                { cmd: '/help', desc: 'Afișează lista comenzilor direct în WhatsApp' },
              ] as { cmd: string; desc: string }[]).map(({ cmd, desc }) => (
                <div key={cmd} className="flex items-start gap-3 py-3">
                  <code className="font-mono text-[12px] text-acid bg-acid/10 px-2 py-1 rounded shrink-0 mt-0.5">{cmd}</code>
                  <span className="font-mono-ui text-[13px] text-dim">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contacte ignorate */}
          <div className="py-7">
            <div className="flex items-center gap-2 mb-5">
              <Shield className="h-4 w-4 text-dimmer" />
              <p className="font-mono-ui text-[11px] text-dimmer uppercase tracking-widest">Contacte ignorate</p>
            </div>
            <p className="font-mono-ui text-[13px] text-dim mb-5">
              Agentul nu va răspunde automat acestor numere de telefon.
            </p>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newPhone}
                onChange={e => { setNewPhone(e.target.value); setPhoneError(null) }}
                onKeyDown={e => e.key === 'Enter' && handleAddPhone()}
                placeholder="ex: 40758154490"
                className="flex-1 rounded-xl border border-line px-3 py-2.5 text-[13px] text-ink bg-cardhi focus:outline-none focus:ring-2 focus:ring-acid/40 focus:border-acid transition-colors"
              />
              <button
                onClick={handleAddPhone}
                disabled={addingPhone || !newPhone.trim()}
                className="flex items-center gap-1.5 bg-ink text-base font-mono-ui text-[13px] px-4 py-2.5 rounded-lg hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {addingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Adaugă
              </button>
            </div>
            {phoneError && <p className="font-mono-ui text-[12px] text-red-500 dark:text-red-400 mb-3">{phoneError}</p>}
            {blacklist.length === 0 ? (
              <p className="font-mono-ui text-[13px] text-dimmer py-4">Niciun contact ignorat.</p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {blacklist.map(phone => (
                  <li key={phone} className="flex items-center justify-between py-3">
                    <span className="font-mono text-[13px] text-ink">+{phone}</span>
                    <button
                      onClick={() => handleRemovePhone(phone)}
                      className="text-dimmer hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Șterge"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
