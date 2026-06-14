// =============================================================
//  ProductosClient.tsx  — Lista del catálogo de productos
//  • AppNavBar global con accesos directos a todas las secciones
//  • Búsqueda por descripción, código de barras y proveedor
//  • Indicadores visuales de stock bajo / sin stock
//  • Editar → navega a /[productoId]
//  • Nuevo → navega a /nuevo
//  • Eliminar → modal de confirmación premium (sin confirm() nativo)
// =============================================================
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Edit2, Trash2, Package, UploadCloud,
  TrendingUp, AlertTriangle, X, Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AppNavBar } from '@/components/pos/AppNavBar'
import type { Producto, Usuario } from '@/types/pos.types'
import { getTenantProductos } from './actions'

interface ProductosClientProps { tenantId: string }

export function ProductosClient({ tenantId }: ProductosClientProps) {
  const router  = useRouter()
  const supabase = createClient(tenantId)

  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading]     = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeUser, setActiveUser] = useState<Usuario | null>(null)

  // ── Predictive Search State ──
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // ── Delete confirmation modal ──
  const [toDelete, setToDelete] = useState<Producto | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Load ──
  const fetchProductos = async () => {
    setLoading(true)
    const data = await getTenantProductos(tenantId)
    setProductos(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchProductos()
    fetch(`/api/tenant/${tenantId}/usuarios`)
      .then(r => r.json())
      .then(d => { if (d.usuarios?.[0]) setActiveUser(d.usuarios[0]) })
      .catch(() => {})
  }, [tenantId])

  // ── Delete ──
  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    const { error } = await supabase
      .from('productos')
      .update({ activo: false })
      .eq('id', toDelete.id)
      .eq('tenant_id', tenantId)

    setDeleting(false)
    setToDelete(null)
    if (!error) fetchProductos()
  }

  // ── Filter ──
  const filtered = productos.filter(p =>
    p.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.codigo_barras && p.codigo_barras.includes(searchTerm)) ||
    (p.nombre_proveedor && p.nombre_proveedor.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

  const stockLevel = (p: Producto) => {
    if (p.stock_actual === 0) return 'none'
    if (p.stock_actual <= p.stock_minimo) return 'low'
    return 'ok'
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white overflow-hidden">

      {/* ── Global Nav Bar ── */}
      <AppNavBar
        tenantId={tenantId}
        activeSection="productos"
        userName={activeUser?.nombre}
        userRole={activeUser?.rol}
      />

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-zinc-800/60 shrink-0">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-400" />
            Catálogo de Productos
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {productos.length} producto{productos.length !== 1 ? 's' : ''} en catálogo
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/${tenantId}/admin/productos/importar`)}
            className="flex items-center gap-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 text-sm font-bold transition-all"
            title="Importar productos desde un archivo CSV"
          >
            <UploadCloud className="h-4 w-4" />
            Importar CSV
          </button>
          <button
            onClick={() => router.push(`/${tenantId}/admin/productos/nuevo`)}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2.5 text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* ── Search bar (Predictive) ── */}
      <div className="px-6 py-3 border-b border-zinc-800/40 shrink-0 relative z-50">
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar o crear producto (escribe y presiona Enter)..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value)
              setIsDropdownOpen(true)
              setHighlightedIndex(-1)
            }}
            onFocus={() => {
              if (searchTerm) setIsDropdownOpen(true)
            }}
            onBlur={() => {
              // Delay closing to allow clicking dropdown items
              setTimeout(() => setIsDropdownOpen(false), 200)
            }}
            onKeyDown={(e) => {
              if (!searchTerm) return
              const maxIndex = Math.min(filtered.length, 5) // up to 5 items + 1 create new
              
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlightedIndex(prev => (prev < maxIndex ? prev + 1 : prev))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlightedIndex(prev => (prev > -1 ? prev - 1 : -1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (highlightedIndex === -1) {
                   if (filtered.length > 0) {
                     router.push(`/${tenantId}/admin/productos/${filtered[0].id}`)
                   } else {
                     router.push(`/${tenantId}/admin/productos/nuevo?desc=${encodeURIComponent(searchTerm)}`)
                   }
                } else if (highlightedIndex === maxIndex) {
                   router.push(`/${tenantId}/admin/productos/nuevo?desc=${encodeURIComponent(searchTerm)}`)
                } else {
                   const selected = filtered[highlightedIndex]
                   if (selected) router.push(`/${tenantId}/admin/productos/${selected.id}`)
                }
              } else if (e.key === 'Escape') {
                setIsDropdownOpen(false)
              }
            }}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 pl-10 pr-4 py-3 text-sm focus:border-emerald-500 focus:outline-none transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); setIsDropdownOpen(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* ── Predictive Dropdown ── */}
          {isDropdownOpen && searchTerm && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-50">
               <ul className="divide-y divide-zinc-800">
                  {filtered.slice(0, 5).map((p, i) => (
                    <li 
                      key={p.id}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      onClick={() => router.push(`/${tenantId}/admin/productos/${p.id}`)}
                      className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-colors ${
                        i === highlightedIndex ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                      }`}
                    >
                       <div>
                         <p className="font-semibold text-white">{p.descripcion}</p>
                         <p className="text-xs text-zinc-500">{p.codigo_barras || 'Sin código'}</p>
                       </div>
                       <div className="text-right">
                         <p className="text-emerald-400 font-bold">{fmt(Number(p.precio_venta))}</p>
                         <p className="text-xs text-zinc-500">Stock: {p.stock_actual}</p>
                       </div>
                    </li>
                  ))}
                  {/* Create New Option */}
                  <li
                    onMouseEnter={() => setHighlightedIndex(Math.min(filtered.length, 5))}
                    onClick={() => router.push(`/${tenantId}/admin/productos/nuevo?desc=${encodeURIComponent(searchTerm)}`)}
                    className={`px-4 py-3 cursor-pointer flex items-center gap-2 transition-colors ${
                      highlightedIndex === Math.min(filtered.length, 5) ? 'bg-emerald-950/40 text-emerald-400' : 'bg-zinc-950 text-emerald-500 hover:bg-emerald-950/20'
                    }`}
                  >
                     <Plus className="h-4 w-4" />
                     <span className="font-medium">Crear nuevo producto: "{searchTerm}"</span>
                  </li>
               </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando catálogo...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-zinc-500">
            <Package className="h-10 w-10 text-zinc-700" />
            <p className="font-medium">
              {searchTerm ? 'Sin resultados para tu búsqueda' : 'No hay productos en el catálogo'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => router.push(`/${tenantId}/admin/productos/nuevo`)}
                className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-500 text-black px-4 py-2 text-sm font-bold hover:bg-emerald-400 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Agregar primer producto
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3 text-right">Costo</th>
                  <th className="px-4 py-3 text-right">Venta</th>
                  <th className="px-4 py-3 text-right text-emerald-500">Ganancia</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-center w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
                {filtered.map(p => {
                  const level = stockLevel(p)
                  const gain  = Number(p.precio_venta) - Number(p.precio_compra)
                  const margin = Number(p.precio_compra) > 0
                    ? ((gain / Number(p.precio_compra)) * 100).toFixed(0)
                    : null

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-zinc-800/30 transition-colors group"
                    >
                      {/* Descripción */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {level === 'none' && (
                            <span title="Sin stock" className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-red-500" />
                          )}
                          {level === 'low' && (
                            <span title="Stock bajo" className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-amber-500" />
                          )}
                          <span className="font-medium text-white truncate max-w-[220px]">
                            {p.descripcion}
                          </span>
                        </div>
                      </td>

                      {/* Código */}
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                        {p.codigo_barras || <span className="text-zinc-700">—</span>}
                      </td>

                      {/* Proveedor */}
                      <td className="px-4 py-3 text-zinc-400 text-xs truncate max-w-[140px]">
                        {p.nombre_proveedor}
                      </td>

                      {/* Costo */}
                      <td className="px-4 py-3 text-right font-mono text-zinc-500 text-xs">
                        {fmt(Number(p.precio_compra))}
                      </td>

                      {/* Venta */}
                      <td className="px-4 py-3 text-right font-mono text-emerald-400 font-semibold">
                        {fmt(Number(p.precio_venta))}
                      </td>

                      {/* Ganancia */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`font-mono text-xs font-bold ${gain > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmt(gain)}
                          </span>
                          {margin && (
                            <span className={`text-[10px] rounded px-1 py-0.5 font-semibold ${
                              Number(margin) >= 20
                                ? 'bg-emerald-500/20 text-emerald-500'
                                : Number(margin) > 0
                                ? 'bg-amber-500/20 text-amber-500'
                                : 'bg-red-500/20 text-red-500'
                            }`}>
                              {margin}%
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Stock */}
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono font-semibold text-sm ${
                          level === 'none' ? 'text-red-400' :
                          level === 'low'  ? 'text-amber-400' :
                          'text-white'
                        }`}>
                          {Number(p.stock_actual)}
                        </span>
                        <span className="text-[10px] text-zinc-600 ml-0.5">{p.unidad_medida}</span>
                        {level !== 'ok' && (
                          <div className="text-[10px] text-zinc-600">
                            {level === 'none' ? 'Sin stock' : `mín. ${p.stock_minimo}`}
                          </div>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => router.push(`/${tenantId}/admin/productos/${p.id}`)}
                            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setToDelete(p)}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/60 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-white">¿Eliminar producto?</h3>
              <p className="text-sm text-zinc-500">Esta acción desactivará el producto del catálogo.</p>
            </div>

            {/* Product preview */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-1">
              <p className="text-sm font-semibold text-white truncate">{toDelete.descripcion}</p>
              {toDelete.codigo_barras && (
                <p className="text-xs font-mono text-zinc-500">{toDelete.codigo_barras}</p>
              )}
              <p className="text-xs text-zinc-600">
                Stock: <span className="text-white">{toDelete.stock_actual} {toDelete.unidad_medida}</span>
                {' · '}
                Precio: <span className="text-emerald-400">{fmt(Number(toDelete.precio_venta))}</span>
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setToDelete(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-zinc-800 py-2.5 text-sm font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-500 hover:bg-red-400 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
