'use client'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { api, type AiSettings, type WhatsappSession } from '@/lib/api'
import { Loader2, Save, Plus, X, Bot, Clock, Shield, Terminal } from 'lucide-react'

const inputCls = 'w-full rounded-xl border border-line px-3 py-2 text-sm text-ink bg-cardhi focus:outline-none focus:ring-2 focus:ring-acid/40 focus:border-acid transition-colors resize-y'

export default function SettingsPage() {
  const { accessToken } = useAuthStore()
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [knowledgeBase, setKnowledgeBase] = useState('')
  const [writingStyle, setWritingStyle] = useState('')
  const [savingStyle, setSavingStyle] = useState(false)
  const [savedStyle, setSavedStyle] = useState(false)
  const [analyzingStyle, setAnalyzingStyle] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState(5)
  const [loading, setLoading] = useState(true)
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [savingKB, setSavingKB] = useState(false)
  const [savedKB, setSavedKB] = useState(false)
  const [savingTimer, setSavingTimer] = useState(false)
  const [togglingAI, setTogglingAI] = useState(false)
  const [savedPrompt, setSavedPrompt] = useState(false)
  const [savedTimer, setSavedTimer] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [waSession, setWaSession] = useState<WhatsappSession | null>(null)
  const [blacklist, setBlacklist] = useState<string[]>([])
  const [newPhone, setNewPhone] = useState('')
  const [addingPhone, setAddingPhone] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    Promise.all([
      api.ai.getSettings(accessToken),
      api.ai.getBlacklist(accessToken),
      api.whatsapp.getSession(accessToken).catch(() => ({ session: null })),
    ])
      .then(([{ settings: s }, { phones }, { session }]) => {
        setSettings(s)
        setSystemPrompt(s.systemPrompt)
        setKnowledgeBase(s.knowledgeBase ?? '')
        setWritingStyle(s.writingStyle ?? '')
        setTimerMinutes(s.timerMinutes)
        setBlacklist(phones)
        setWaSession(session)
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
    setSavingPrompt(true)
    setSavedPrompt(false)
    setError(null)
    try {
      const { settings: updated } = await api.ai.updateSettings(accessToken, { systemPrompt })
      setSettings(updated)
      setSavedPrompt(true)
      setTimeout(() => setSavedPrompt(false), 3000)
    } catch {
      setError('Eroare la salvarea promptului.')
    } finally {
      setSavingPrompt(false)
    }
  }

  async function handleSaveTimer() {
    if (!accessToken) return
    setSavingTimer(true)
    setSavedTimer(false)
    setError(null)
    try {
      const { settings: updated } = await api.ai.updateSettings(accessToken, { timerMinutes })
      setSettings(updated)
      setSavedTimer(true)
      setTimeout(() => setSavedTimer(false), 3000)
    } catch {
      setError('Eroare la salvarea timerului.')
    } finally {
      setSavingTimer(false)
    }
  }

  async function handleAnalyzeStyle() {
    if (!accessToken) return
    setAnalyzingStyle(true)
    setError(null)
    try {
      const { writingStyle: detected } = await api.ai.analyzeStyle(accessToken)
      setWritingStyle(detected)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la analiză. Asigură-te că ai cel puțin 5 mesaje trimise.')
    } finally {
      setAnalyzingStyle(false)
    }
  }

  async function handleSaveStyle() {
    if (!accessToken) return
    setSavingStyle(true)
    setSavedStyle(false)
    setError(null)
    try {
      const { settings: updated } = await api.ai.updateSettings(accessToken, { writingStyle })
      setSettings(updated)
      setSavedStyle(true)
      setTimeout(() => setSavedStyle(false), 3000)
    } catch {
      setError('Eroare la salvarea stilului.')
    } finally {
      setSavingStyle(false)
    }
  }

  async function handleSaveKB() {
    if (!accessToken) return
    setSavingKB(true)
    setSavedKB(false)
    setError(null)
    try {
      const { settings: updated } = await api.ai.updateSettings(accessToken, { knowledgeBase })
      setSettings(updated)
      setSavedKB(true)
      setTimeout(() => setSavedKB(false), 3000)
    } catch {
      setError('Eroare la salvarea informațiilor.')
    } finally {
      setSavingKB(false)
    }
  }

  async function handleAddPhone() {
    if (!accessToken || !newPhone.trim()) return
    const cleaned = newPhone.replace(/[^0-9]/g, '')
    if (cleaned.length < 7) {
      setPhoneError('Număr prea scurt — minim 7 cifre.')
      return
    }
    setAddingPhone(true)
    setPhoneError(null)
    try {
      await api.ai.addBlacklist(accessToken, cleaned)
      setBlacklist(prev => [...prev, cleaned])
      setNewPhone('')
    } catch {
      setPhoneError('Eroare la adăugare. Încearcă din nou.')
    } finally {
      setAddingPhone(false)
    }
  }

  async function handleRemovePhone(phone: string) {
    if (!accessToken) return
    try {
      await api.ai.removeBlacklist(accessToken, phone)
      setBlacklist(prev => prev.filter(p => p !== phone))
    } catch {
      setError('Eroare la ștergerea numărului.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-acid" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-32">
      <div>
        <h1 className="font-display text-[32px] text-ink leading-none">Setări Agent AI</h1>
        <p className="font-mono-ui text-[12px] text-dim mt-1">Configurează comportamentul agentului tău.</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 font-mono-ui text-[12px] text-red-700 dark:text-red-300">{error}</div>
      )}

      {/* Stare agent */}
      <div className="card-elevated rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-4 w-4 text-dimmer" />
          <h2 className="font-mono-ui text-[12px] text-ink font-medium">Stare agent</h2>
        </div>

        {settings?.adminDisabled ? (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 font-mono-ui text-[12px] text-orange-800 dark:text-orange-300">
            Agentul a fost dezactivat de administrator. Contactează suportul pentru reactivare.
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono-ui text-[12px] text-ink font-medium">
                {settings?.isActive ? 'Agentul este activ' : 'Agentul este inactiv'}
              </p>
              <p className="font-mono-ui text-[11px] text-dimmer mt-0.5">
                {settings?.isActive
                  ? 'Răspunde automat când ești indisponibil.'
                  : 'Nu răspunde la mesaje automat.'}
              </p>
            </div>
            <button
              onClick={handleToggleAI}
              disabled={togglingAI}
              style={settings?.isActive ? { background: 'var(--acid)' } : undefined}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                settings?.isActive ? '' : 'bg-cardhi border border-line'
              }`}
            >
              {togglingAI
                ? <Loader2 className="h-3 w-3 animate-spin text-white absolute left-1/2 -translate-x-1/2" />
                : <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${settings?.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              }
            </button>
          </div>
          {settings?.isActive && waSession?.status !== 'connected' && (
            <div className="mt-3 rounded-lg px-3 py-2 font-mono-ui text-[11px] text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
              Agentul e activ dar WhatsApp nu este conectat — mesajele nu vor primi răspuns.{' '}
              <a href="/connect" className="underline underline-offset-2">Conectează numărul</a>
            </div>
          )}
        )}
      </div>

      {/* Timer inactivitate */}
      <div className="card-elevated rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-dimmer" />
          <h2 className="font-mono-ui text-[12px] text-ink font-medium">Timer inactivitate</h2>
        </div>
        <p className="font-mono-ui text-[12px] text-dim mb-4">
          Agentul răspunde automat după câte minute de inactivitate din partea ta.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={60}
            value={timerMinutes}
            onChange={e => setTimerMinutes(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
            className="w-20 rounded-xl border border-line px-3 py-2 text-sm text-ink bg-cardhi text-center focus:outline-none focus:ring-2 focus:ring-acid/40 focus:border-acid transition-colors"
          />
          <span className="font-mono-ui text-[12px] text-dim">minute (1–60)</span>
          <button
            onClick={handleSaveTimer}
            disabled={savingTimer}
            style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
            className="ml-auto flex items-center gap-2 text-sm font-mono-ui px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {savingTimer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvează
          </button>
          {savedTimer && <span className="font-mono-ui text-[12px] text-green-600 dark:text-green-400 font-medium">Salvat!</span>}
        </div>
      </div>

      {/* System prompt */}
      <div className="card-elevated rounded-xl p-6">
        <h2 className="font-mono-ui text-[12px] text-ink font-medium mb-1">System prompt</h2>
        <p className="font-mono-ui text-[12px] text-dim mb-4">
          Descrie cum să se comporte agentul: ton, limbă, instrucțiuni speciale.
        </p>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          rows={10}
          className={`${inputCls} font-mono`}
          placeholder="Ești un asistent WhatsApp helpful..."
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleSavePrompt}
            disabled={savingPrompt || systemPrompt === settings?.systemPrompt}
            style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
            className="flex items-center gap-2 text-sm font-mono-ui px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {savingPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvează promptul
          </button>
          {savedPrompt && <span className="font-mono-ui text-[12px] text-green-600 dark:text-green-400 font-medium">Salvat!</span>}
        </div>
      </div>

      {/* Writing Style */}
      <div className="card-elevated rounded-xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-mono-ui text-[12px] text-ink font-medium">Stilul meu de scriere</h2>
          <button
            onClick={handleAnalyzeStyle}
            disabled={analyzingStyle}
            className="flex items-center gap-2 font-mono-ui text-[12px] text-acid hover:underline disabled:opacity-50"
          >
            {analyzingStyle ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {analyzingStyle ? 'Analizez...' : 'Analizează automat'}
          </button>
        </div>
        <p className="font-mono-ui text-[12px] text-dim mb-4">
          Agentul va imita stilul tău de comunicare. Apasă &ldquo;Analizează automat&rdquo; pentru a detecta stilul din istoricul conversațiilor, sau scrie manual.
        </p>
        <textarea
          value={writingStyle}
          onChange={e => setWritingStyle(e.target.value)}
          rows={5}
          className={inputCls}
          placeholder="Ex: Scriu scurt și direct, fără formule de politețe exagerate. Folosesc uneori emoji 😊. Prefer să întreb înainte de a da soluții."
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleSaveStyle}
            disabled={savingStyle || writingStyle === (settings?.writingStyle ?? '')}
            style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
            className="flex items-center gap-2 text-sm font-mono-ui px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {savingStyle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvează stilul
          </button>
          {savedStyle && <span className="font-mono-ui text-[12px] text-green-600 dark:text-green-400 font-medium">Salvat!</span>}
        </div>
      </div>

      {/* Knowledge Base */}
      <div className="card-elevated rounded-xl p-6">
        <h2 className="font-mono-ui text-[12px] text-ink font-medium mb-1">Informații despre business</h2>
        <p className="font-mono-ui text-[12px] text-dim mb-4">
          Adaugă serviciile, produsele sau orice informație pe care agentul trebuie să o cunoască. Când un client întreabă ceva specific, agentul va folosi aceste informații.
        </p>
        <textarea
          value={knowledgeBase}
          onChange={e => setKnowledgeBase(e.target.value)}
          rows={8}
          className={inputCls}
          placeholder={'Exemplu:\n\nServicii oferite:\n- Creare site WordPress – site-uri profesionale, responsive\n- Aplicații web custom – React, Node.js\n- Mentenanță și hosting\n\nProgram: Luni–Vineri 09:00–17:00\nContact: contact@firma.ro'}
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleSaveKB}
            disabled={savingKB || knowledgeBase === (settings?.knowledgeBase ?? '')}
            style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
            className="flex items-center gap-2 text-sm font-mono-ui px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {savingKB ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvează informațiile
          </button>
          {savedKB && <span className="font-mono-ui text-[12px] text-green-600 dark:text-green-400 font-medium">Salvat!</span>}
        </div>
      </div>

      {/* Comenzi WhatsApp */}
      <div className="card-elevated rounded-xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Terminal className="h-4 w-4 text-dimmer" />
          <h2 className="font-mono-ui text-[12px] text-ink font-medium">Comenzi WhatsApp</h2>
        </div>
        <p className="font-mono-ui text-[12px] text-dim mb-4">
          Trimite aceste comenzi de pe numărul tău conectat direct în WhatsApp pentru a controla agentul în timp real.
        </p>
        <div className="divide-y divide-line">
          {([
            { cmd: '/activateAI', desc: 'Activează agentul' },
            { cmd: '/deactivateAI', desc: 'Dezactivează agentul' },
            { cmd: '/pauseAI 2h', desc: 'Pauză X ore — înlocuiește 2 cu numărul dorit' },
            { cmd: '/resumeAI', desc: 'Scoate agentul din pauză' },
            { cmd: '/setTimer 5min', desc: 'Setează timer-ul de inactivitate (1–60 min)' },
            { cmd: '/status', desc: 'Verifică starea curentă a agentului' },
            { cmd: '/skipAI +407...', desc: 'Ignoră un contact — agentul nu îi mai răspunde' },
            { cmd: '/unskipAI +407...', desc: 'Re-activează un contact ignorat' },
            { cmd: '/clearHistory', desc: 'Șterge istoricul conversației curente cu un contact' },
            { cmd: '/help', desc: 'Afișează lista comenzilor direct în WhatsApp' },
          ] as { cmd: string; desc: string }[]).map(({ cmd, desc }) => (
            <div key={cmd} className="flex items-start gap-3 py-2.5">
              <code className="font-mono text-[11px] text-acid bg-acid/10 px-2 py-0.5 rounded shrink-0 mt-0.5">{cmd}</code>
              <span className="font-mono-ui text-[12px] text-dim">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Blacklist */}
      <div className="card-elevated rounded-xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-4 w-4 text-dimmer" />
          <h2 className="font-mono-ui text-[12px] text-ink font-medium">Contacte ignorate</h2>
        </div>
        <p className="font-mono-ui text-[12px] text-dim mb-4">
          Agentul nu va răspunde automat acestor numere de telefon.
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newPhone}
            onChange={e => { setNewPhone(e.target.value); setPhoneError(null) }}
            onKeyDown={e => e.key === 'Enter' && handleAddPhone()}
            placeholder="ex: 40758154490"
            className="flex-1 rounded-xl border border-line px-3 py-2 text-sm text-ink bg-cardhi focus:outline-none focus:ring-2 focus:ring-acid/40 focus:border-acid transition-colors"
          />
          <button
            onClick={handleAddPhone}
            disabled={addingPhone || !newPhone.trim()}
            className="flex items-center gap-1.5 bg-ink text-base text-sm font-mono-ui px-3 py-2 rounded-lg hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {addingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adaugă
          </button>
        </div>
        {phoneError && <p className="font-mono-ui text-[11px] text-red-500 dark:text-red-400 mb-3">{phoneError}</p>}

        {blacklist.length === 0 ? (
          <p className="font-mono-ui text-[12px] text-dimmer text-center py-4">Niciun contact ignorat.</p>
        ) : (
          <ul className="divide-y divide-line">
            {blacklist.map(phone => (
              <li key={phone} className="flex items-center justify-between py-2.5">
                <span className="font-mono text-sm text-ink">+{phone}</span>
                <button
                  onClick={() => handleRemovePhone(phone)}
                  className="text-dimmer hover:text-red-500 transition-colors p-1 rounded"
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
  )
}
