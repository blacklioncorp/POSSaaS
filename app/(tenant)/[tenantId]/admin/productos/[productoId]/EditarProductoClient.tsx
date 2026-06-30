// =============================================================
//  EditarProductoClient.tsx
//  Página de EDICIÓN de producto — idéntica a Nuevo pero:
//   • Precarga todos los datos del producto existente
//   • Guarda con UPDATE en lugar de INSERT
//   • Muestra historial de precios (precio actual vs. lo que ingresas)
// =============================================================
'use client'

import {
  useState, useEffect, useRef, useCallback, KeyboardEvent
} from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Package, Save, Loader2,
  TrendingUp, TrendingDown, AlertTriangle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AppNavBar } from '@/components/pos/AppNavBar'
import type { Producto, HistorialPrecio } from '@/types/pos.types'
import Link from 'next/link'

interface Props { tenantId: string; productoId: string }

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

export function EditarProductoClient({ tenantId, productoId }: Props) {
  const router = useRouter()
  const supabase = createClient(tenantId)

  const [allProductos, setAllProductos] = useState<Producto[]>([])
  const [original, setOriginal] = useState<Producto | null>(null)
  const [historial, setHistorial] = useState<HistorialPrecio[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    codigo_barras: '',
    descripcion: '',
    precio_compra: '',
    precio_venta: '',
    precio_mayoreo: '',
    stock_actual: '0',
    stock_minimo: '0',
    unidad_medida: 'pza',
    nombre_proveedor: '',
  })

  // ── Proveedor autocomplete ──
  const [provQuery, setProvQuery] = useState('')
  const [provHits, setProvHits] = useState<string[]>([])
  const [provDropOpen, setProvDropOpen] = useState(false)
  const [provHighlighted, setProvHighlighted] = useState(-1)

  // ── Load product to edit + all products (for provider suggestions) ──
  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: prod }, { data: todos }, { data: hist }] = await Promise.all([
        supabase.from('productos').select('*').eq('id', productoId).eq('tenant_id', tenantId).single(),
        supabase.from('productos').select('*').eq('tenant_id', tenantId).eq('activo', true).order('descripcion'),
        supabase.from('historial_precios').select('*').eq('producto_id', productoId).eq('tenant_id', tenantId).order('creado_en', { ascending: false }).limit(5),
      ])

      if (prod) {
        setOriginal(prod as Producto)
        setAllProductos((todos || []) as Producto[])
        setHistorial((hist || []) as HistorialPrecio[])
        setForm({
          codigo_barras: prod.codigo_barras || '',
          descripcion: prod.descripcion || '',
          precio_compra: prod.precio_compra?.toString() || '0',
          precio_venta: prod.precio_venta?.toString() || '0',
          precio_mayoreo: prod.precio_mayoreo?.toString() || '',
          stock_actual: prod.stock_actual?.toString() || '0',
          stock_minimo: prod.stock_minimo?.toString() || '0',
          unidad_medida: prod.unidad_medida || 'pza',
          nombre_proveedor: prod.nombre_proveedor || '',
        })
        setProvQuery(prod.nombre_proveedor || '')
      }
      setLoading(false)
    }
    load()
  }, [productoId, tenantId, supabase])

  // ── Keyboard shortcut Ctrl+S ──
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        document.getElementById('btn-guardar-edit')?.click()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Provider autocomplete ──
  useEffect(() => {
    const provs = Array.from(new Set(allProductos.map(p => p.nombre_proveedor).filter(Boolean))).sort()
    if (provQuery.length === 0) { setProvHits([]); setProvDropOpen(false); return }
    const q = provQuery.toLowerCase()
    const filtered = provs.filter(p => p.toLowerCase().includes(q)).slice(0, 6)
    setProvHits(filtered)
    setProvDropOpen(filtered.length > 0)
    setProvHighlighted(-1)
  }, [provQuery, allProductos])

  const pickProvider = useCallback((prov: string) => {
    setProvQuery(prov)
    setForm(f => ({ ...f, nombre_proveedor: prov }))
    setProvDropOpen(false)
    setProvHighlighted(-1)
  }, [])

  const handleProvKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!provDropOpen || provHits.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setProvHighlighted(h => Math.min(h + 1, provHits.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setProvHighlighted(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter' && provHighlighted >= 0) { e.preventDefault(); pickProvider(provHits[provHighlighted]) }
    else if (e.key === 'Escape') setProvDropOpen(false)
  }

  // ── Computed profit ──
  const compra   = parseFloat(form.precio_compra)  || 0
  const venta    = parseFloat(form.precio_venta)   || 0
  const ganancia = venta - compra
  const margen   = compra > 0 ? ((ganancia / compra) * 100) : 0

  const formatMXN = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

  const handleSave = async () => {
    setError('')
    if (!form.descripcion.trim()) { setError('La descripción es requerida.'); return }
    if (!form.precio_venta || parseFloat(form.precio_venta) <= 0) {
      setError('El precio de venta debe ser mayor a 0.')
      return
    }

    setSaving(true)
    const payload = {
      codigo_barras: form.codigo_barras || null,
      descripcion: form.descripcion.trim(),
      precio_compra: parseFloat(form.precio_compra) || 0,
      precio_venta: parseFloat(form.precio_venta) || 0,
      precio_mayoreo: form.precio_mayoreo ? parseFloat(form.precio_mayoreo) : null,
      stock_actual: parseFloat(form.stock_actual) || 0,
      stock_minimo: parseFloat(form.stock_minimo) || 0,
      unidad_medida: form.unidad_medida,
      nombre_proveedor: form.nombre_proveedor.trim() || 'Sin Proveedor',
    }

    const { error: err } = await supabase
      .from('productos')
      .update(payload)
      .eq('id', productoId)
      .eq('tenant_id', tenantId)

    setSaving(false)
    if (err) { setError('Error al guardar: ' + err.message); return }
    router.push(`/${tenantId}/admin/productos`)
  }

  if (loading) {
    return (
      <div className="flex h-screen flex-col bg-zinc-950 text-white">
        <AppNavBar tenantId={tenantId} activeSection="productos" />
        <div className="flex flex-1 items-center justify-center gap-3 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando producto...
        </div>
      </div>
    )
  }

  if (!original) {
    return (
      <div className="flex h-screen flex-col bg-zinc-950 text-white">
        <AppNavBar tenantId={tenantId} activeSection="productos" />
        <div className="flex flex-1 items-center justify-center flex-col gap-3 text-zinc-500">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <p>Producto no encontrado.</p>
          <button
            onClick={() => router.push(`/${tenantId}/admin/productos`)}
            className="mt-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700 transition-colors"
          >
            Volver al catálogo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white overflow-hidden">
      <AppNavBar tenantId={tenantId} activeSection="productos" />

      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-zinc-800/60 shrink-0">
        <button
          onClick={() => router.push(`/${tenantId}/admin/productos`)}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-400" />
            Editar Producto
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-sm">
            {original.descripcion}
          </p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Form ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Descripción */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Descripción <span className="text-emerald-500">*</span>
            </label>
            <input
              type="text"
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition-all"
            />
          </div>

          {/* Código + Proveedor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Código de Barras</label>
              <input
                type="text"
                value={form.codigo_barras}
                onChange={e => setForm(f => ({ ...f, codigo_barras: e.target.value }))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Proveedor</label>
              <div className="relative">
                <input
                  type="text" autoComplete="off"
                  value={provQuery}
                  onChange={e => { setProvQuery(e.target.value); setForm(f => ({ ...f, nombre_proveedor: e.target.value })) }}
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
                        className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${i === provHighlighted ? 'bg-emerald-500/10 text-emerald-300' : 'text-zinc-300 hover:bg-zinc-800/60'}`}
                      >
                        {highlight(prov, provQuery)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Precios */}
          <div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Precios</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Costo ($)</label>
                <input type="number" step="0.01" min="0" value={form.precio_compra}
                  onChange={e => setForm(f => ({ ...f, precio_compra: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm tabular-nums focus:border-emerald-500 focus:outline-none transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">
                  Precio de Venta ($) <span className="text-emerald-500">*</span>
                </label>
                <input type="number" step="0.01" min="0" required value={form.precio_venta}
                  onChange={e => setForm(f => ({ ...f, precio_venta: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-semibold tabular-nums focus:border-emerald-500 focus:outline-none transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Precio Mayoreo ($) <span className="text-zinc-700 font-normal">(opcional)</span></label>
                <input type="number" step="0.01" min="0" value={form.precio_mayoreo}
                  onChange={e => setForm(f => ({ ...f, precio_mayoreo: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm tabular-nums focus:border-emerald-500 focus:outline-none transition-colors" />
              </div>
            </div>
          </div>

          {/* Stock + Unidad */}
          <div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Inventario</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Stock Actual</label>
                <input type="number" step="any" min="0" value={form.stock_actual}
                  onChange={e => setForm(f => ({ ...f, stock_actual: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm tabular-nums focus:border-emerald-500 focus:outline-none transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Stock Mínimo</label>
                <input type="number" step="any" min="0" value={form.stock_minimo}
                  onChange={e => setForm(f => ({ ...f, stock_minimo: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm tabular-nums focus:border-emerald-500 focus:outline-none transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Unidad</label>
                <select value={form.unidad_medida} onChange={e => setForm(f => ({ ...f, unidad_medida: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none transition-colors">
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

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => router.push(`/${tenantId}/admin/productos`)}
              className="rounded-xl border border-zinc-800 px-5 py-2.5 text-sm font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              id="btn-guardar-edit"
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-6 py-2.5 text-sm font-bold text-black shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {/* ── Right: Summary ── */}
        <aside className="w-72 shrink-0 border-l border-zinc-800 bg-zinc-900/40 flex flex-col overflow-y-auto p-5 space-y-5">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Resumen</h2>

          {/* Current vs original price */}
          {original && parseFloat(form.precio_venta) !== original.precio_venta && (
            <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 text-xs space-y-1">
              <p className="text-amber-400 font-bold">Cambio de precio</p>
              <div className="flex justify-between text-zinc-400">
                <span>Anterior</span>
                <span className="line-through">{formatMXN(original.precio_venta)}</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-semibold">
                <span>Nuevo</span>
                <span>{formatMXN(parseFloat(form.precio_venta) || 0)}</span>
              </div>
            </div>
          )}

          {/* Profit */}
          <div className={`rounded-xl border p-4 space-y-3 transition-colors ${ganancia > 0 ? 'border-emerald-800/50 bg-emerald-950/30' : 'border-zinc-800 bg-zinc-900'}`}>
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-4 w-4 ${ganancia > 0 ? 'text-emerald-500' : 'text-zinc-600'}`} />
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Rentabilidad</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Costo</span><span className="font-mono font-semibold text-zinc-300">{formatMXN(compra)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Venta</span><span className="font-mono font-semibold text-emerald-400">{formatMXN(venta)}</span></div>
              <div className="border-t border-zinc-800 pt-2 flex justify-between">
                <span className="text-zinc-400 font-semibold">Ganancia</span>
                <span className={`font-mono font-bold text-lg ${ganancia >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMXN(ganancia)}</span>
              </div>
              {compra > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Margen</span>
                  <span className={`font-mono font-bold ${margen >= 20 ? 'text-emerald-400' : margen > 0 ? 'text-amber-400' : 'text-red-400'}`}>{margen.toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Stock */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Stock</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold tabular-nums text-white">{form.stock_actual || 0}</span>
              <span className="text-sm text-zinc-500 mb-1">{form.unidad_medida}</span>
            </div>
            <p className="text-xs text-zinc-600">Mínimo: {form.stock_minimo || 0} {form.unidad_medida}</p>
          </div>

          {/* Historial de Precios Reciente */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Últimas Compras</p>
            </div>
            
            {historial.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No hay historial registrado.</p>
            ) : (
              <div className="space-y-2">
                {historial.map((h, i) => {
                  const diff = h.precio_anterior ? h.precio_compra - h.precio_anterior : 0;
                  const pct = h.precio_anterior ? (Math.abs(diff) / h.precio_anterior) * 100 : 0;
                  const date = new Date(h.creado_en).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
                  
                  return (
                    <div key={h.id} className={`flex items-center justify-between text-xs py-1.5 ${i !== historial.length - 1 ? 'border-b border-zinc-800/50' : ''}`}>
                      <div className="flex flex-col">
                        <span className="text-zinc-300 font-medium">{date}</span>
                        <span className="text-zinc-500 truncate max-w-[80px]">{h.nombre_proveedor}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-emerald-400 font-mono font-semibold">{formatMXN(h.precio_compra)}</span>
                        {diff !== 0 && (
                          <span className={`text-[10px] flex items-center gap-0.5 ${diff < 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {diff < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : <TrendingUp className="h-2.5 w-2.5" />}
                            {pct.toFixed(1)}%
                          </span>
                        )}
                        {diff === 0 && <span className="text-[10px] text-zinc-600">—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="pt-2">
              <Link href={`/${tenantId}/admin/historial-precios?producto=${productoId}`} className="text-xs text-amber-500 hover:text-amber-400 font-semibold transition-colors flex items-center gap-1">
                Ver historial completo &rarr;
              </Link>
            </div>
          </div>

          {/* Shortcuts */}
          <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-4 space-y-2">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Atajos</p>
            <ul className="space-y-1.5 text-[11px] text-zinc-600">
              <li>Ctrl+S <span className="text-zinc-500">guardar cambios</span></li>
              <li>Esc <span className="text-zinc-500">cerrar dropdown</span></li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
