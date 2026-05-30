'use client'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { api, type Product } from '@/lib/api'
import { Loader2, Plus, Pencil, Trash2, X, Package, Save } from 'lucide-react'

const inputCls = 'w-full rounded-xl border border-line px-3 py-2.5 text-[13px] text-ink bg-cardhi focus:outline-none focus:ring-2 focus:ring-acid/40 focus:border-acid transition-colors'

function formatLei(bani: number): string {
  return (bani / 100).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type FormState = {
  name: string
  description: string
  priceLei: string
  category: string
  isAvailable: boolean
}

const EMPTY_FORM: FormState = { name: '', description: '', priceLei: '', category: '', isAvailable: true }

export default function ProductsPage() {
  const { accessToken } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // null = formular închis; '' = produs nou; id = editare
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    api.products.list(accessToken)
      .then(({ products: p }) => setProducts(p))
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

    setSaving(true); setFormError(null)
    try {
      const payload = {
        name,
        description: form.description.trim(),
        priceLei,
        category: form.category.trim(),
        isAvailable: form.isAvailable,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-acid" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] text-ink leading-none">Catalog produse</h1>
          <p className="font-mono-ui text-[13px] text-dim mt-1">
            Produsele pe care agentul le poate oferi clienților la comandă.
          </p>
        </div>
        {editingId === null && (
          <button
            onClick={openCreate}
            style={{ background: 'var(--acid)', color: 'var(--on-acid)' }}
            className="flex items-center gap-2 font-mono-ui text-[13px] px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity shrink-0"
          >
            <Plus className="h-4 w-4" />
            Adaugă produs
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 font-mono-ui text-[13px] text-red-700 dark:text-red-300 mb-6">{error}</div>
      )}

      {/* Formular adăugare/editare */}
      {editingId !== null && (
        <div className="border border-line rounded-xl p-5 mb-8 bg-cardhi/40">
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
                <label className="font-mono-ui text-[12px] text-dim block mb-1.5">Preț (lei) *</label>
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
      )}

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
          {products.map(p => (
            <li key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-cardhi/40 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono-ui text-[14px] text-ink font-medium">{p.name}</span>
                  {p.category && (
                    <span className="font-mono-ui text-[10px] text-dim bg-cardhi px-2 py-0.5 rounded-full">{p.category}</span>
                  )}
                  {!p.isAvailable && (
                    <span className="font-mono-ui text-[10px] text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">indisponibil</span>
                  )}
                </div>
                {p.description && (
                  <p className="font-mono-ui text-[12px] text-dimmer mt-0.5 truncate">{p.description}</p>
                )}
              </div>
              <span className="font-display text-[18px] text-ink shrink-0">{formatLei(p.priceBani)} <span className="text-[12px] text-dim">lei</span></span>
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
          ))}
        </ul>
      )}
    </div>
  )
}
