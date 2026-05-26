'use client'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { api, type AiSettings } from '@/lib/api'
import { Loader2, Save, Plus, X, Bot, Clock, Shield } from 'lucide-react'

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

  // Blacklist
  const [blacklist, setBlacklist] = useState<string[]>([])
  const [newPhone, setNewPhone] = useState('')
  const [addingPhone, setAddingPhone] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    Promise.all([
      api.ai.getSettings(accessToken),
      api.ai.getBlacklist(accessToken),
    ])
      .then(([{ settings: s }, { phones }]) => {
        setSettings(s)
        setSystemPrompt(s.systemPrompt)
        setKnowledgeBase(s.knowledgeBase ?? '')
        setWritingStyle(s.writingStyle ?? '')
        setTimerMinutes(s.timerMinutes)
        setBlacklist(phones)
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
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-32">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Setări Agent AI</h1>
        <p className="text-sm text-gray-500 mt-1">Configurează comportamentul agentului tău.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Stare agent */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-4 w-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Stare agent</h2>
        </div>

        {settings?.adminDisabled ? (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
            Agentul a fost dezactivat de administrator. Contactează suportul pentru reactivare.
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">
                {settings?.isActive ? 'Agentul este activ' : 'Agentul este inactiv'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {settings?.isActive
                  ? 'Răspunde automat când ești indisponibil.'
                  : 'Nu răspunde la mesaje automat.'}
              </p>
            </div>
            <button
              onClick={handleToggleAI}
              disabled={togglingAI}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                settings?.isActive ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              {togglingAI
                ? <Loader2 className="h-3 w-3 animate-spin text-white absolute left-1/2 -translate-x-1/2" />
                : <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${settings?.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              }
            </button>
          </div>
        )}
      </div>

      {/* Timer inactivitate */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Timer inactivitate</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Agentul răspunde automat după câte minute de inactivitate din partea ta.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={60}
            value={timerMinutes}
            onChange={e => setTimerMinutes(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
            className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <span className="text-sm text-gray-500">minute (1–60)</span>
          <button
            onClick={handleSaveTimer}
            disabled={savingTimer}
            className="ml-auto flex items-center gap-2 bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {savingTimer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvează
          </button>
          {savedTimer && <span className="text-sm text-green-600 font-medium">Salvat!</span>}
        </div>
      </div>

      {/* System prompt */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-semibold text-gray-900">System prompt</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Descrie cum să se comporte agentul: ton, limbă, instrucțiuni speciale.
        </p>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          rows={10}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y font-mono"
          placeholder="Ești un asistent WhatsApp helpful..."
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleSavePrompt}
            disabled={savingPrompt || systemPrompt === settings?.systemPrompt}
            className="flex items-center gap-2 bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {savingPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvează promptul
          </button>
          {savedPrompt && <span className="text-sm text-green-600 font-medium">Salvat!</span>}
        </div>
      </div>

      {/* Writing Style */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-gray-900">Stilul meu de scriere</h2>
          <button
            onClick={handleAnalyzeStyle}
            disabled={analyzingStyle}
            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
          >
            {analyzingStyle ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {analyzingStyle ? 'Analizez...' : 'Analizează automat'}
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Agentul va imita stilul tău de comunicare. Apasă &ldquo;Analizează automat&rdquo; pentru a detecta stilul din istoricul conversațiilor, sau scrie manual.
        </p>
        <textarea
          value={writingStyle}
          onChange={e => setWritingStyle(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
          placeholder="Ex: Scriu scurt și direct, fără formule de politețe exagerate. Folosesc uneori emoji 😊. Prefer să întreb înainte de a da soluții."
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleSaveStyle}
            disabled={savingStyle || writingStyle === (settings?.writingStyle ?? '')}
            className="flex items-center gap-2 bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {savingStyle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvează stilul
          </button>
          {savedStyle && <span className="text-sm text-green-600 font-medium">Salvat!</span>}
        </div>
      </div>

      {/* Knowledge Base */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-semibold text-gray-900">Informații despre business</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Adaugă serviciile, produsele sau orice informație pe care agentul trebuie să o cunoască. Când un client întreabă ceva specific, agentul va folosi aceste informații.
        </p>
        <textarea
          value={knowledgeBase}
          onChange={e => setKnowledgeBase(e.target.value)}
          rows={8}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
          placeholder={'Exemplu:\n\nServicii oferite:\n- Creare site WordPress – site-uri profesionale, responsive\n- Aplicații web custom – React, Node.js\n- Mentenanță și hosting\n\nProgram: Luni–Vineri 09:00–17:00\nContact: contact@firma.ro'}
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleSaveKB}
            disabled={savingKB || knowledgeBase === (settings?.knowledgeBase ?? '')}
            className="flex items-center gap-2 bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {savingKB ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvează informațiile
          </button>
          {savedKB && <span className="text-sm text-green-600 font-medium">Salvat!</span>}
        </div>
      </div>

      {/* Blacklist */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-4 w-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Contacte ignorate</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Agentul nu va răspunde automat acestor numere de telefon.
        </p>

        {/* Add phone */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newPhone}
            onChange={e => { setNewPhone(e.target.value); setPhoneError(null) }}
            onKeyDown={e => e.key === 'Enter' && handleAddPhone()}
            placeholder="ex: 40758154490"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button
            onClick={handleAddPhone}
            disabled={addingPhone || !newPhone.trim()}
            className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {addingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adaugă
          </button>
        </div>
        {phoneError && <p className="text-xs text-red-500 mb-3">{phoneError}</p>}

        {/* List */}
        {blacklist.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Niciun contact ignorat.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {blacklist.map(phone => (
              <li key={phone} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-mono text-gray-700">+{phone}</span>
                <button
                  onClick={() => handleRemovePhone(phone)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
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
