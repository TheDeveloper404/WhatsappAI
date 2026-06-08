'use client'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { api, type Product } from '@/lib/api'
import { parseCsv, rowsToProducts, type ParsedProduct } from '@/lib/csv'
import { formatAmount, currencyLabel } from '@/lib/format'
import { Loader2, Plus, Pencil, Trash2, X, Package, Save, Upload, FileSpreadsheet } from 'lucide-react'
import { SalesTabs } from '@/components/SalesTabs'

const inputCls = 'w-full rounded-xl border border-line px-3 py-2.5 text-[13px] text-ink bg-cardhi focus:outline-none focus:ring-2 focus:ring-acid/40 focus:border-acid transition-colors'

type FormState = {
  name: string
  description: string
  priceLei: string
  category: string
  isAvailable: boolean
  isEstimate: boolean  // preț „începând de la" (proiecte custom) — agentul nu propune total fix
  isBookable: boolean  // serviciu rezervabil — agentul face programare cu handoff la owner
  stock: string  // '' = nelimitat; altfel număr întreg >= 0
}

const EMPTY_FORM: FormState = { name: '', description: '', priceLei: '', category: '', isAvailable: true, isEstimate: false, isBookable: false, stock: '' }

export default function ProductsPage() {
  const { accessToken } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([])
  const [currency, setCurrency] = useState('RON')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // null = formular închis; '' = produs nou; id = editare
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Import CSV
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importPreview, setImportPreview] = useState<ParsedProduct[] | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    Promise.all([
      api.products.list(accessToken),
      api.ai.getSettings(accessToken).catch(() => null),
    ])
      .then(([{ products: p }, settingsRes]) => {
        setProducts(p)
        if (settingsRes?.settings.currency) setCurrency(settingsRes.settings.currency)
      })
      .catch(() => setError('Nu s-a putut încărca catalogul.'))
      .finally(() => setLoading(false))
  }, [accessToken])

  function openCreate() {
    setEditingId('')
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  function openEdit(p: Product) {
    setEditingId(p.id)
    setForm({
      name: p.name,
      description: p.description,
      priceLei: (p.priceBani / 100).toFixed(2),
      category: p.category,
      isAvailable: p.isAvailable,
      isEstimate: p.isEstimate ?? false,
      isBookable: p.isBookable ?? false,
      stock: p.stock === null || p.stock === undefined ? '' : String(p.stock),
    })
    setFormError(null)
  }

  function closeForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  async function handleSave() {
    if (!accessToken) return
    const name = form.name.trim()
    const priceLei = parseFloat(form.priceLei.replace(',', '.'))
    if (!name) { setFormError('Numele este obligatoriu.'); return }
    if (isNaN(priceLei) || priceLei < 0) { setFormError('Prețul trebuie să fie un număr valid.'); return }

    // Stoc: gol → null (nelimitat); altfel întreg >= 0.
    let stock: number | null = null
    const stockRaw = form.stock.trim()
    if (stockRaw !== '') {
      const n = parseInt(stockRaw, 10)
      if (isNaN(n) || n < 0) { setFormError('Stocul trebuie să fie un număr întreg pozitiv (sau gol = nelimitat).'); return }
      stock = n
    }

    setSaving(true); setFormError(null)
    try {
      const payload = {
        name,
        description: form.description.trim(),
        priceLei,
        category: form.category.trim(),
        isAvailable: form.isAvailable,
        isEstimate: form.isEstimate,
        isBookable: form.isBookable,
        stock,
      }
      if (editingId) {
        await api.products.update(accessToken, editingId, payload)
      } else {
        await api.products.create(accessToken, payload)
      }
      const { products: p } = await api.products.list(accessToken)
      setProducts(p)
      closeForm()
    } catch {
      setFormError('Eroare la salvare. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const rows = parseCsv(text)
      const { products: parsed, errors } = rowsToProducts(rows)
      if (parsed.length === 0 && errors.length === 0) {
        setError('Fișierul pare gol sau nu are coloanele așteptate (nume, preț).')
        return
      }
      setImportPreview(parsed)
      setImportErrors(errors)
    }
    reader.onerror = () => setError('Nu s-a putut citi fișierul.')
    reader.readAsText(file)
    // reset input ca să poți reîncărca același fișier
    e.target.value = ''
  }

  function cancelImport() {
    setImportPreview(null)
    setImportErrors([])
  }

  async function confirmImport() {
    if (!accessToken || !importPreview || importPreview.length === 0) return
    setImporting(true); setError(null)
    try {
      await api.products.import(accessToken, importPreview)
      const { products: p } = await api.products.list(accessToken)
      setProducts(p)
      cancelImport()
    } catch {
      setError('Eroare la import. Încearcă din nou.')
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken) return
    setDeletingId(id)
    try {
      await api.products.remove(accessToken, id)
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch {
      setError('Eroare la ștergerea produsului.')
    } finally {
      setDeletingId(null)
    }
  }

  // Formularul de adăugare/editare. Folosit în DOUĂ locuri: sus pentru „Produs nou", și inline
  // (în locul rândului) la editarea unui produs — ca userul să nu mai urce în capul paginii.
  const formPanel = (
    <div className="border border-line rounded-xl p-5 bg-cardhi/40">
      <div className="flex items-center justify-between mb-5">
        <p className="font-mono-ui text-[14px] text-ink font-medium">
          {editingId ? 'Editează produs' : 'Produs nou'}
        </p>
        <button onClick={closeForm} className="p-1.5 text-dimmer hover:text-ink hover:bg-cardhi rounded-lg transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="font-mono-ui text-[12px] text-dim block mb-1.5">Nume *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="ex: Pizza Margherita"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-mono-ui text-[12px] text-dim block mb-1.5">Preț ({currencyLabel(currency)}) *</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.priceLei}
              onChange={e => setForm(f => ({ ...f, priceLei: e.target.value }))}
              placeholder="35.00"
              className={inputCls}
            />
          </div>
          <div>
            <label className="font-mono-ui text-[12px] text-dim block mb-1.5">Categorie</label>
            <input
              type="text"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              placeholder="ex: Pizza"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="font-mono-ui text-[12px] text-dim block mb-1.5">Stoc</label>
          <input
            type="text"
            inputMode="numeric"
            value={form.stock}
            onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
            placeholder="lasă gol = nelimitat (ex: servicii)"
            className={inputCls}
          />
          <p className="font-mono-ui text-[11px] text-dimmer mt-1">
            Gol = nelimitat. Un număr = cantitate reală; scade automat la fiecare comandă. 0 = epuizat.
          </p>
        </div>

        <div>
          <label className="font-mono-ui text-[12px] text-dim block mb-1.5">Descriere</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            placeholder="ex: Roșii, mozzarella, busuioc"
            className={`${inputCls} resize-y`}
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, isAvailable: !f.isAvailable }))}
            style={form.isAvailable ? { background: 'var(--acid)' } : undefined}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
              form.isAvailable ? '' : 'bg-cardhi border border-line'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${form.isAvailable ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="font-mono-ui text-[13px] text-dim">
            Disponibil {form.isAvailable ? '— agentul îl poate oferi' : '— ascuns, agentul nu îl oferă'}
          </span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, isEstimate: !f.isEstimate }))}
            style={form.isEstimate ? { background: 'var(--acid)' } : undefined}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
              form.isEstimate ? '' : 'bg-cardhi border border-line'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${form.isEstimate ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="font-mono-ui text-[13px] text-dim">
            Preț estimativ („de la”) {form.isEstimate ? '— proiect custom; agentul nu propune un total fix, predă ofertarea ție' : '— preț fix; agentul poate finaliza comanda'}
          </span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, isBookable: !f.isBookable }))}
            style={form.isBookable ? { background: 'var(--acid)' } : undefined}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
              form.isBookable ? '' : 'bg-cardhi border border-line'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${form.isBookable ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="font-mono-ui text-[13px] text-dim">
            Rezervabil {form.isBookable ? '— serviciu pe programare; agentul strânge intervalul, tu confirmi' : '— fără programare'}
          </span>
        </label>

        {formError && <p className="font-mono-ui text-[12px] text-red-500 dark:text-red-400">{formError}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
            className="flex items-center gap-2 font-mono-ui text-[13px] px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editingId ? 'Salvează modificările' : 'Adaugă în catalog'}
          </button>
          <button onClick={closeForm} className="font-mono-ui text-[13px] text-dim hover:text-ink transition-colors">
            Anulează
          </button>
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-acid" />
      </div>
    )
  }

  return (
    <div>
      <SalesTabs />
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] text-ink leading-none">Catalog produse</h1>
          <p className="font-mono-ui text-[13px] text-dim mt-1">
            Produsele pe care agentul le poate oferi clienților la comandă.
          </p>
        </div>
        {editingId === null && importPreview === null && (
          <div className="flex items-center gap-2 sm:shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 font-mono-ui text-[13px] px-4 py-2.5 rounded-lg border border-line text-dim hover:text-ink hover:bg-cardhi transition-colors"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </button>
            <button
              onClick={openCreate}
              style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 font-mono-ui text-[13px] px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Adaugă produs
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 font-mono-ui text-[13px] text-red-700 dark:text-red-300 mb-6">{error}</div>
      )}

      {/* Panou import CSV — preview înainte de confirmare */}
      {importPreview !== null && (
        <div className="border border-line rounded-xl p-5 mb-8 bg-cardhi/40">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-acid" />
              <p className="font-mono-ui text-[14px] text-ink font-medium">
                Previzualizare import — {importPreview.length} produse valide
              </p>
            </div>
            <button onClick={cancelImport} className="p-1.5 text-dimmer hover:text-ink hover:bg-cardhi rounded-lg transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="font-mono-ui text-[12px] text-dim mb-4">
            Coloane așteptate: <code className="text-acid">nume</code>, <code className="text-acid">pret</code> (obligatorii) +
            opțional <code className="text-acid">categorie</code>, <code className="text-acid">descriere</code>, <code className="text-acid">disponibil</code>, <code className="text-acid">estimativ</code>, <code className="text-acid">rezervabil</code>.
            Produsele se adaugă la cele existente (nu le înlocuiesc).
          </p>

          {importErrors.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
              <p className="font-mono-ui text-[12px] text-amber-800 dark:text-amber-300 font-medium mb-1">
                {importErrors.length} rânduri ignorate:
              </p>
              <ul className="font-mono-ui text-[11px] text-amber-700 dark:text-amber-400 space-y-0.5 max-h-24 overflow-y-auto">
                {importErrors.slice(0, 10).map((e, i) => <li key={i}>• {e}</li>)}
                {importErrors.length > 10 && <li>… și încă {importErrors.length - 10}</li>}
              </ul>
            </div>
          )}

          {importPreview.length > 0 && (
            <div className="border border-line rounded-lg overflow-hidden mb-4 max-h-64 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-cardhi sticky top-0">
                  <tr className="font-mono-ui text-[11px] text-dimmer uppercase tracking-wider">
                    <th className="px-3 py-2">Nume</th>
                    <th className="px-3 py-2">Categorie</th>
                    <th className="px-3 py-2 text-right">Preț</th>
                    <th className="px-3 py-2 text-center">Disp.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {importPreview.slice(0, 50).map((p, i) => (
                    <tr key={i} className="font-mono-ui text-[12px] text-ink">
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2 text-dim">{p.category || '—'}</td>
                      <td className="px-3 py-2 text-right">{p.priceLei.toFixed(2)} lei</td>
                      <td className="px-3 py-2 text-center">{p.isAvailable ? '✓' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importPreview.length > 50 && (
                <p className="font-mono-ui text-[11px] text-dimmer px-3 py-2 bg-cardhi/40">… și încă {importPreview.length - 50} produse</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={confirmImport}
              disabled={importing || importPreview.length === 0}
              style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
              className="flex items-center gap-2 font-mono-ui text-[13px] px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importă {importPreview.length} produse
            </button>
            <button onClick={cancelImport} className="font-mono-ui text-[13px] text-dim hover:text-ink transition-colors">
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* Formular „Produs nou" — apare sus. Editarea apare inline, în dreptul produsului (vezi lista). */}
      {editingId === '' && <div className="mb-8">{formPanel}</div>}

      {/* Lista produse */}
      {products.length === 0 ? (
        <div className="border border-dashed border-line rounded-xl py-16 flex flex-col items-center gap-3">
          <Package className="h-8 w-8 text-dimmer" />
          <p className="font-mono-ui text-[13px] text-dimmer">Niciun produs în catalog.</p>
          {editingId === null && (
            <button onClick={openCreate} className="font-mono-ui text-[13px] text-acid hover:underline">
              Adaugă primul produs →
            </button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--line)] border border-line rounded-xl overflow-hidden">
          {products.map(p =>
            editingId === p.id ? (
              // Editare inline: formularul ia locul rândului, exact în dreptul produsului.
              <li key={p.id} className="p-3 sm:p-4 bg-cardhi/20">
                {formPanel}
              </li>
            ) : (
              <li key={p.id} className="flex items-center gap-3 px-4 sm:px-5 py-4 hover:bg-cardhi/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono-ui text-[14px] text-ink font-medium break-words">{p.name}</span>
                    {p.category && (
                      <span className="font-mono-ui text-[10px] text-dim bg-cardhi px-2 py-0.5 rounded-full">{p.category}</span>
                    )}
                    {!p.isAvailable && (
                      <span className="font-mono-ui text-[10px] text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">indisponibil</span>
                    )}
                    {p.isEstimate && (
                      <span className="font-mono-ui text-[10px] text-acid bg-acid/10 px-2 py-0.5 rounded-full">preț de la</span>
                    )}
                    {p.isBookable && (
                      <span className="font-mono-ui text-[10px] text-acid bg-acid/10 px-2 py-0.5 rounded-full">rezervabil</span>
                    )}
                    {p.stock !== null && p.stock !== undefined && (
                      p.stock === 0
                        ? <span className="font-mono-ui text-[10px] text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">epuizat</span>
                        : <span className="font-mono-ui text-[10px] text-dim bg-cardhi px-2 py-0.5 rounded-full">stoc: {p.stock}</span>
                    )}
                  </div>
                  {p.description && (
                    <p className="font-mono-ui text-[12px] text-dimmer mt-0.5 truncate">{p.description}</p>
                  )}
                  <span className="font-display text-[16px] text-ink mt-1 block sm:hidden">{formatAmount(p.priceBani)} <span className="text-[11px] text-dim">{currencyLabel(currency)}</span></span>
                </div>
                <span className="font-display text-[18px] text-ink shrink-0 hidden sm:block">{formatAmount(p.priceBani)} <span className="text-[12px] text-dim">{currencyLabel(currency)}</span></span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(p)}
                    className="text-dimmer hover:text-ink transition-colors p-2 rounded-lg hover:bg-cardhi"
                    title="Editează"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    className="text-dimmer hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    title="Șterge"
                  >
                    {deletingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}
