// =============================================================
//  components/pos/SearchModal.tsx
//  Búsqueda manual de productos — F2
//  Busca por descripción, código de barras o categoría.
// =============================================================
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Producto } from '@/types/pos.types'

interface SearchModalProps {
  open: boolean
  tenantId: string
  onSelect: (producto: Producto) => void
  onClose: () => void
}

export function SearchModal({ open, tenantId, onSelect, onClose }: SearchModalProps) {
  const supabase = createClient()
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<Producto[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setIsSearching(true)
    try {
      const { data } = await supabase.rpc('buscar_producto_pos', {
        p_tenant_id: tenantId,
        p_query: q,
        p_limit: 12,
      })
      setResults((data as Producto[]) ?? [])
      setSelectedIdx(0)
    } finally {
      setIsSearching(false)
    }
  }, [supabase, tenantId])

  const handleInput = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 200)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      onSelect(results[selectedIdx])
      onClose()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <span className="text-zinc-500 text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar por descripción, código de barras..."
            value={query}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
          />
          {isSearching && (
            <span className="text-xs text-zinc-500 animate-pulse">Buscando...</span>
          )}
          <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 && query && !isSearching && (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              Sin resultados para <span className="text-white">"{query}"</span>
            </p>
          )}
          {results.length === 0 && !query && (
            <p className="px-4 py-8 text-center text-sm text-zinc-600">
              Escribe para buscar productos
            </p>
          )}
          {results.map((p, i) => (
            <button
              key={p.id}
              onClick={() => { onSelect(p); onClose() }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                i === selectedIdx
                  ? 'bg-emerald-500/10 border-l-2 border-emerald-500'
                  : 'hover:bg-zinc-800 border-l-2 border-transparent'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{p.descripcion}</p>
                <p className="text-xs text-zinc-500">
                  {p.codigo_barras && <span className="font-mono mr-2">{p.codigo_barras}</span>}
                  {p.nombre_categoria && <span className="text-zinc-600">· {p.nombre_categoria}</span>}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-emerald-400">${p.precio_venta.toFixed(2)}</p>
                <p className={`text-xs ${
                  p.stock_actual === 0 ? 'text-red-400' :
                  p.stock_actual <= p.stock_minimo ? 'text-amber-400' :
                  'text-zinc-500'
                }`}>
                  Stock: {p.stock_actual} {p.unidad_medida}
                </p>
              </div>
            </button>
          ))}
        </div>

        {results.length > 0 && (
          <div className="border-t border-zinc-800 px-4 py-2 flex gap-4 text-xs text-zinc-600">
            <span>↑↓ Navegar</span>
            <span>↵ Seleccionar</span>
            <span>Esc Cerrar</span>
          </div>
        )}
      </div>
    </div>
  )
}
