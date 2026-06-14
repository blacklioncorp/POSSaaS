// =============================================================
//  NuevoProductoClient.tsx
//  Página de CREACIÓN de producto — diseño premium con:
//   • Texto predictivo: descripción + código de barras
//     muestra precio venta + stock en el dropdown
//   • Navegación ↑↓ + Enter para seleccionar
//   • Autocompletado de todos los campos
//   • Cálculo en tiempo real de ganancia y margen %
//   • Ctrl+S para guardar
//   • "Guardar y nuevo" para captura rápida
// =============================================================
'use client'

import {
  useState, useEffect, useRef, useCallback, KeyboardEvent
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Package, Save, RefreshCw,
  TrendingUp, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AppNavBar } from '@/components/pos/AppNavBar'
import type { Producto } from '@/types/pos.types'

interface Props { tenantId: string }

const EMPTY_FORM = {
  codigo_barras: '',
  descripcion: '',
  precio_compra: '',
  precio_venta: '',
  precio_mayoreo: '',
  stock_actual: '0',
  stock_minimo: '0',
  unidad_medida: 'pza',
  nombre_proveedor: '',
}

// ── Predictive search result ──────────────────────────────────
interface SearchHit {
  id: string
  descripcion: string
  codigo_barras: string | null
  precio_venta: number
  stock_actual: number
  stock_minimo: number
  unidad_medida: string
  precio_compra: number
  precio_mayoreo: number | null
  nombre_proveedor: string
}

function highlight(text: string, query: string) {
  if (!query.trim()) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-emerald-500/30 text-emerald-300 rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </span>
  )
}

export function NuevoProductoClient({ tenantId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultDesc = searchParams.get('desc') || ''
  
  const supabase = createClient(tenantId)

  const [allProductos, setAllProductos] = useState<SearchHit[]>([])
  const [form, setForm] = useState({ ...EMPTY_FORM, descripcion: defaultDesc })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // ── Predictive search state ──
  const [query, setQuery] = useState(defaultDesc)              // what's typed in descripcion
  const [hits, setHits] = useState<SearchHit[]>([])  // filtered results
  const [dropOpen, setDropOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const descRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLUListElement>(null)

  // ── Proveedor suggestions ──
  const [provQuery, setProvQuery] = useState('')
  const [provHits, setProvHits] = useState<string[]>([])
  const [provDropOpen, setProvDropOpen] = useState(false)
  const [provHighlighted, setProvHighlighted] = useState(-1)

  // ── Load all products once ──
  useEffect(() => {
    supabase
      .from('productos')
      .select('id,descripcion,codigo_barras,precio_venta,precio_compra,precio_mayoreo,stock_actual,stock_minimo,unidad_medida,nombre_proveedor')
      .eq('tenant_id', tenantId)
      .eq('activo', true)
      .order('descripcion')
      .then(({ data }) => {
        if (data) setAllProductos(data as SearchHit[])
      })
  }, [tenantId, supabase])

  // ── Keyboard shortcut Ctrl+S ──
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        document.getElementById('btn-guardar')?.click()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Filter description hits ──
  useEffect(() => {
    if (query.length === 0) { setHits([]); setDropOpen(false); return }
    const q = query.toLowerCase()
    const filtered = allProductos
      .filter(p =>
        p.descripcion.toLowerCase().includes(q) ||
        (p.codigo_barras && p.codigo_barras.includes(q))
      )
      .slice(0, 8)
    setHits(filtered)
    setDropOpen(filtered.length > 0)
    setHighlighted(-1)
  }, [query, allProductos])

  // ── Filter provider hits ──
  useEffect(() => {
    const provs = Array.from(new Set(allProductos.map(p => p.nombre_proveedor).filter(Boolean))).sort()
    if (provQuery.length === 0) { setProvHits([]); setProvDropOpen(false); return }
    const q = provQuery.toLowerCase()
    const filtered = provs.filter(p => p.toLowerCase().includes(q)).slice(0, 6)
    setProvHits(filtered)
    setProvDropOpen(filtered.length > 0)
    setProvHighlighted(-1)
  }, [provQuery, allProductos])

  // ── Autofill form from selected product ──
  const pickProduct = useCallback((hit: SearchHit) => {
    setQuery(hit.descripcion)
    setForm({
      codigo_barras: hit.codigo_barras || '',
      descripcion: hit.descripcion,
      precio_compra: hit.precio_compra?.toString() || '0',
      precio_venta: hit.precio_venta?.toString() || '0',
      precio_mayoreo: hit.precio_mayoreo?.toString() || '',
      stock_actual: hit.stock_actual?.toString() || '0',
      stock_minimo: hit.stock_minimo?.toString() || '0',
      unidad_medida: hit.unidad_medida || 'pza',
      nombre_proveedor: hit.nombre_proveedor || '',
    })
    setProvQuery(hit.nombre_proveedor || '')
    setDropOpen(false)
    setHighlighted(-1)
  }, [])

  const pickProvider = useCallback((prov: string) => {
    setProvQuery(prov)
    setForm(f => ({ ...f, nombre_proveedor: prov }))
    setProvDropOpen(false)
    setProvHighlighted(-1)
  }, [])

  // ── Desc key navigation ──
  const handleDescKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!dropOpen || hits.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      pickProduct(hits[highlighted])
    } else if (e.key === 'Escape') {
      setDropOpen(false)
    }
  }

  // ── Provider key navigation ──
  const handleProvKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!provDropOpen || provHits.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setProvHighlighted(h => Math.min(h + 1, provHits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setProvHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && provHighlighted >= 0) {
      e.preventDefault()
      pickProvider(provHits[provHighlighted])
    } else if (e.key === 'Escape') {
      setProvDropOpen(false)
    }
  }

  // ── Computed profit ──
  const compra  = parseFloat(form.precio_compra)  || 0
  const venta   = parseFloat(form.precio_venta)   || 0
  const ganancia = venta - compra
  const margen  = compra > 0 ? ((ganancia / compra) * 100) : 0

  const formatMXN = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

  // ── Save ──
  const handleSave = async (andNew = false) => {
    setError('')
    if (!form.descripcion.trim()) { setError('La descripción es requerida.'); return }
    if (!form.precio_venta || parseFloat(form.precio_venta) <= 0) {
      setError('El precio de venta debe ser mayor a 0.')
      return
    }

    setSaving(true)
    const payload = {
      tenant_id: tenantId,
      codigo_barras: form.codigo_barras || null,
      descripcion: form.descripcion.trim(),
      precio_compra: parseFloat(form.precio_compra) || 0,
      precio_venta: parseFloat(form.precio_venta) || 0,
      precio_mayoreo: form.precio_mayoreo ? parseFloat(form.precio_mayoreo) : null,
      stock_actual: parseFloat(form.stock_actual) || 0,
      stock_minimo: parseFloat(form.stock_minimo) || 0,
      unidad_medida: form.unidad_medida,
      nombre_proveedor: form.nombre_proveedor.trim() || 'Sin Proveedor',
      activo: true,
    }

    const { error: err } = await supabase.from('productos').insert([payload])
    setSaving(false)

    if (err) {
      setError('Error al guardar: ' + err.message)
      return
    }

    if (andNew) {
      setSaved(true)
      setForm({ ...EMPTY_FORM })
      setQuery('')
      setProvQuery('')
      setTimeout(() => { setSaved(false); descRef.current?.focus() }, 1800)
    } else {
      router.push(`/${tenantId}/admin/productos`)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white overflow-hidden">
      <AppNavBar tenantId={tenantId} activeSection="productos" />

      {/* ── Page header ── */}
      <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-zinc-800/60 shrink-0">
        <button
          onClick={() => router.push(`/${tenantId}/admin/productos`)}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-400" />
            Nuevo Producto
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Escribe la descripción para buscar o crear un producto nuevo ·{' '}
            <kbd className="rounded bg-zinc-800 border border-zinc-700 px-1">Ctrl+S</kbd> para guardar
          </p>
        </div>
      </div>

      {/* ── Main body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Form ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Success flash */}
          {saved && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-emerald-400 text-sm font-semibold animate-pulse">
              <CheckCircle2 className="h-4 w-4" />
              Producto guardado correctamente. Listo para el siguiente.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* ── Descripción (predictive) ── */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Descripción <span className="text-emerald-500">*</span>
            </label>
            <div className="relative">
              <input
                ref={descRef}
                autoFocus
                type="text"
                autoComplete="off"
                value={query}
                placeholder="Escribe para buscar o crear un producto nuevo..."
                onChange={e => {
                  setQuery(e.target.value)
                  setForm(f => ({ ...f, descripcion: e.target.value }))
                }}
                onKeyDown={handleDescKey}
                onFocus={() => { if (query.length > 0 && hits.length > 0) setDropOpen(true) }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
              />

              {/* Dropdown */}
              {dropOpen && hits.length > 0 && (
                <ul
                  ref={dropRef}
                  className="absolute z-50 mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/70 overflow-hidden divide-y divide-zinc-800/60"
                >
                  {hits.map((hit, i) => {
                    const stockColor =
                      hit.stock_actual === 0 ? 'text-red-400' :
                      hit.stock_actual <= hit.stock_minimo ? 'text-amber-400' :
                      'text-emerald-400'

                    return (
                      <li
                        key={hit.id}
                        onMouseDown={e => { e.preventDefault(); pickProduct(hit) }}
                        onMouseEnter={() => setHighlighted(i)}
                        className={`flex items-center justify-between gap-4 px-4 py-2.5 cursor-pointer transition-colors ${
                          i === highlighted
                            ? 'bg-emerald-500/10'
                            : 'hover:bg-zinc-800/60'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {highlight(hit.descripcion, query)}
                          </p>
                          {hit.codigo_barras && (
                            <p className="text-xs text-zinc-500 font-mono mt-0.5">
                              {highlight(hit.codigo_barras, query)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs">
                          <span className="text-emerald-400 font-bold tabular-nums">
                            {formatMXN(hit.precio_venta)}
                          </span>
                          <span className={`font-semibold tabular-nums ${stockColor}`}>
                            {hit.stock_actual} {hit.unidad_medida}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                  <li className="px-4 py-2 text-[10px] text-zinc-600 text-center">
                    ↑↓ navegar · Enter seleccionar · Esc cerrar
                  </li>
                </ul>
              )}
            </div>
          </div>

          {/* ── Código de barras + Proveedor ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Código de Barras
              </label>
              <input
                type="text"
                value={form.codigo_barras}
                onChange={e => setForm(f => ({ ...f, codigo_barras: e.target.value }))}
                placeholder="Ej. 7501000001234"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Proveedor with autocomplete */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Proveedor
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoComplete="off"
                  value={provQuery}
                  placeholder="Nombre del proveedor"
                  onChange={e => {
                    setProvQuery(e.target.value)
                    setForm(f => ({ ...f, nombre_proveedor: e.target.value }))
                  }}
                  onKeyDown={handleProvKey}
                  onFocus={() => { if (provQuery.length > 0 && provHits.length > 0) setProvDropOpen(true) }}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none transition-colors"
                />
                {provDropOpen && provHits.length > 0 && (
                  <ul className="absolute z-50 mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/70 overflow-hidden divide-y divide-zinc-800/60">
                    {provHits.map((prov, i) => (
                      <li
                        key={prov}
                        onMouseDown={e => { e.preventDefault(); pickProvider(prov) }}
                        onMouseEnter={() => setProvHighlighted(i)}
                        className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                          i === provHighlighted
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'text-zinc-300 hover:bg-zinc-800/60'
                        }`}
                      >
                        {highlight(prov, provQuery)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* ── Precios ── */}
          <div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Precios</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Costo ($)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={form.precio_compra}
                  onChange={e => setForm(f => ({ ...f, precio_compra: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm tabular-nums focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">
                  Precio de Venta ($) <span className="text-emerald-500">*</span>
                </label>
                <input
                  type="number" step="0.01" min="0" required
                  value={form.precio_venta}
                  onChange={e => setForm(f => ({ ...f, precio_venta: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-semibold tabular-nums focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Precio Mayoreo ($) <span className="text-zinc-700 font-normal">(opcional)</span></label>
                <input
                  type="number" step="0.01" min="0"
                  value={form.precio_mayoreo}
                  onChange={e => setForm(f => ({ ...f, precio_mayoreo: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm tabular-nums focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* ── Stock + Unidad ── */}
          <div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Inventario</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Stock Actual</label>
                <input
                  type="number" step="any" min="0"
                  value={form.stock_actual}
                  onChange={e => setForm(f => ({ ...f, stock_actual: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm tabular-nums focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Stock Mínimo</label>
                <input
                  type="number" step="any" min="0"
                  value={form.stock_minimo}
                  onChange={e => setForm(f => ({ ...f, stock_minimo: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm tabular-nums focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Unidad de Medida</label>
                <select
                  value={form.unidad_medida}
                  onChange={e => setForm(f => ({ ...f, unidad_medida: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none transition-colors"
                >
                  <option value="pza">Pieza</option>
                  <option value="kg">Kilogramo</option>
                  <option value="litro">Litro</option>
                  <option value="metro">Metro</option>
                  <option value="caja">Caja</option>
                  <option value="docena">Docena</option>
                  <option value="par">Par</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => router.push(`/${tenantId}/admin/productos`)}
              className="rounded-xl border border-zinc-800 px-5 py-2.5 text-sm font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              id="btn-guardar"
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-6 py-2.5 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar Producto'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="flex items-center gap-2 rounded-xl border border-emerald-800/60 bg-emerald-950/40 px-5 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-900/40 transition-all disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Guardar y nuevo
            </button>
          </div>
        </div>

        {/* ── Right: Summary panel ── */}
        <aside className="w-72 shrink-0 border-l border-zinc-800 bg-zinc-900/40 flex flex-col overflow-y-auto p-5 space-y-5">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Resumen</h2>

          {/* Product name preview */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
            <p className="text-xs text-zinc-500">Descripción</p>
            <p className="text-sm font-semibold text-white min-h-[2.5rem] leading-snug">
              {form.descripcion || <span className="text-zinc-600 italic">Sin descripción</span>}
            </p>
            {form.codigo_barras && (
              <p className="text-xs font-mono text-zinc-600 mt-1">{form.codigo_barras}</p>
            )}
          </div>

          {/* Profit card */}
          <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
            ganancia > 0
              ? 'border-emerald-800/50 bg-emerald-950/30'
              : 'border-zinc-800 bg-zinc-900'
          }`}>
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-4 w-4 ${ganancia > 0 ? 'text-emerald-500' : 'text-zinc-600'}`} />
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Rentabilidad</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Costo</span>
                <span className="font-mono font-semibold text-zinc-300 tabular-nums">{formatMXN(compra)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Venta</span>
                <span className="font-mono font-semibold text-emerald-400 tabular-nums">{formatMXN(venta)}</span>
              </div>
              <div className="border-t border-zinc-800 pt-2 flex justify-between items-center">
                <span className="text-zinc-400 font-semibold">Ganancia</span>
                <span className={`font-mono font-bold text-lg tabular-nums ${ganancia >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatMXN(ganancia)}
                </span>
              </div>
              {compra > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Margen</span>
                  <span className={`font-mono font-bold tabular-nums ${margen >= 20 ? 'text-emerald-400' : margen > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                    {margen.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Stock preview */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Stock</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold tabular-nums text-white">{form.stock_actual || 0}</span>
              <span className="text-sm text-zinc-500 mb-1">{form.unidad_medida}</span>
            </div>
            <p className="text-xs text-zinc-600">Mínimo: {form.stock_minimo || 0} {form.unidad_medida}</p>
          </div>

          {/* Provider */}
          {form.nombre_proveedor && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs text-zinc-500 mb-1">Proveedor</p>
              <p className="text-sm font-semibold text-white">{form.nombre_proveedor}</p>
            </div>
          )}

          {/* Tips */}
          <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-4 space-y-2">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Atajos</p>
            <ul className="space-y-1.5 text-[11px] text-zinc-600">
              <li>↑↓ <span className="text-zinc-500">navegar sugerencias</span></li>
              <li>Enter <span className="text-zinc-500">seleccionar sugerencia</span></li>
              <li>Ctrl+S <span className="text-zinc-500">guardar producto</span></li>
              <li>Esc <span className="text-zinc-500">cerrar dropdown</span></li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
