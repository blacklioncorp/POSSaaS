// =============================================================
//  app/(tenant)/[tenantId]/ventas/VentasClient.tsx
//  Pantalla de ventas estilo SICAR con soporte para turnos y cajeros.
// =============================================================
'use client'

import {
  useEffect, useRef, useState, useCallback, useTransition
} from 'react'
import { usePOS } from '@/lib/hooks/usePOS'
import { PaymentModal }  from '@/components/pos/PaymentModal'
import { SearchModal }   from '@/components/pos/SearchModal'
import { TicketPrint }   from '@/components/pos/TicketPrint'
import { AppNavBar }     from '@/components/pos/AppNavBar'
import type {
  PagoPayload, VentaResult, Cliente, Usuario, Producto
} from '@/types/pos.types'
import { KeyRound, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface VentasClientProps {
  tenantId: string
}

const MOCK_COMERCIO = { nombre: 'Abarrotes Demo SA', rfc: 'ABAR010101ABC' }

export function VentasClient({ tenantId }: VentasClientProps) {
  const router = useRouter()

  // ── Operadores y Clientes ──────────────────────────────────
  const [operadores, setOperadores] = useState<Usuario[]>([])
  const [activeUser, setActiveUser] = useState<Usuario | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])

  // ── Caja / Turnos ──────────────────────────────────────────
  const [activeShift, setActiveShift] = useState<any | null>(null)
  const [showAperturaModal, setShowAperturaModal] = useState(false)
  const [aperturaCash, setAperturaCash] = useState('100')
  const [showCierreModal, setShowCierreModal] = useState(false)
  const [cierreCash, setCierreCash] = useState('')
  const [cierreNotas, setCierreNotas] = useState('')

  // ── usePOS hook ──
  const {
    tabs, activeTabIdx, activeTab, isLoading, lastAdded,
    subtotal, total, totalItems,
    escanear, buscarProducto, agregarItem,
    setCantidad, setPrecio, eliminarItem,
    setDescuento, setCliente, limpiarTab,
    addTab, nextTab, setActiveTabIdx,
    procesarVenta,
  } = usePOS(tenantId, activeUser?.id || '', activeShift?.id || null)

  // ── Modales POS ──
  const [showPago, setShowPago]           = useState(false)
  const [showSearch, setShowSearch]       = useState(false)
  const [showDescuento, setShowDescuento] = useState(false)

  // ── Post-venta ──
  const [ultimaVenta, setUltimaVenta]       = useState<VentaResult | null>(null)
  const [showTicketPreview, setShowTicketPreview] = useState(false)
  const ticketRef = useRef<HTMLDivElement>(null)

  // ── Scanner input ──
  const scannerRef    = useRef<HTMLInputElement>(null)
  const [scanVal, setScanVal]     = useState('')
  const [scanError, setScanError] = useState('')
  const [scanFlash, setScanFlash] = useState<'ok' | 'error' | null>(null)

  // ── Ítem seleccionado en tabla ──
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null)

  // ── Descuento input ──
  const [descInput, setDescInput] = useState('')

  const [, startTransition] = useTransition()

  // ── Autocomplete (Predictivo) ──
  const [autoResults, setAutoResults] = useState<Producto[]>([])
  const [showAuto, setShowAuto] = useState(false)
  const [autoIdx, setAutoIdx] = useState(0)
  const autoDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient(tenantId)

  // ── Cargar operadores y clientes al montar ──
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [resUsers, resClients] = await Promise.all([
          fetch(`/api/tenant/${tenantId}/usuarios`),
          fetch(`/api/tenant/${tenantId}/clientes`),
        ])
        
        if (resUsers.ok) {
          const data = await resUsers.json()
          setOperadores(data.usuarios)
          if (data.usuarios.length > 0) {
            setActiveUser(data.usuarios[0])
          }
        }
        
        if (resClients.ok) {
          const data = await resClients.json()
          setClientes(data.clientes)
        }
      } catch (err) {
        console.error('Error cargando catálogo:', err)
      }
    }
    loadInitialData()
  }, [tenantId])

  // ── Cargar turno activo del operador seleccionado ──
  const fetchActiveShift = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/tenant/${tenantId}/turnos?usuarioId=${userId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.shift) {
          setActiveShift(data.shift)
          setShowAperturaModal(false)
        } else {
          setActiveShift(null)
          setShowAperturaModal(true)
        }
      }
    } catch (err) {
      console.error('Error cargando turno:', err)
    }
  }, [tenantId])

  useEffect(() => {
    if (activeUser) {
      fetchActiveShift(activeUser.id)
    }
  }, [activeUser, fetchActiveShift])

  // ── Apertura de turno ──
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeUser) return

    try {
      const res = await fetch(`/api/tenant/${tenantId}/turnos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: activeUser.id,
          montoApertura: parseFloat(aperturaCash) || 0,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setActiveShift(data.shift)
        setShowAperturaModal(false)
        setScanError('')
      } else {
        const data = await res.json()
        setScanError(data.error || 'Error al abrir caja')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // ── Cierre de turno ──
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeShift) return

    try {
      const res = await fetch(`/api/tenant/${tenantId}/turnos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: activeShift.id,
          montoCierre: parseFloat(cierreCash) || 0,
          notas: cierreNotas,
        }),
      })

      if (res.ok) {
        setActiveShift(null)
        setShowCierreModal(false)
        setShowAperturaModal(true)
        setCierreCash('')
        setCierreNotas('')
        setScanError('Turno cerrado exitosamente.')
      } else {
        const data = await res.json()
        setScanError(data.error || 'Error al cerrar caja')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // ── Mantener foco en el scanner siempre ──
  const refocusScanner = useCallback(() => {
    if (showPago || showSearch || showDescuento || showAperturaModal || showCierreModal) return
    scannerRef.current?.focus()
  }, [showPago, showSearch, showDescuento, showAperturaModal, showCierreModal])

  useEffect(() => {
    const t = setTimeout(refocusScanner, 100)
    return () => clearTimeout(t)
  })

  // ── Atajos de teclado globales ──
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isScanner = e.target === scannerRef.current
      const isInput = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && !isScanner

      switch (e.key) {
        case 'F1':
          e.preventDefault()
          if (!isInput) {
            if (!activeShift) {
              setShowAperturaModal(true)
            } else {
              setShowPago(v => !v)
            }
          }
          break

        case 'F2':
          e.preventDefault()
          if (!isInput) setShowSearch(v => !v)
          break

        case 'F3':
          e.preventDefault()
          if (!isInput) nextTab()
          break

        case 'F4':
          e.preventDefault()
          if (!isInput) {
            if (activeUser?.rol !== 'admin') {
              setScanError('Solo administradores pueden aplicar descuentos.')
              return
            }
            setShowDescuento(v => !v)
          }
          break

        case 'F5':
          e.preventDefault()
          if (!isInput && activeShift) setShowCierreModal(true)
          break

        case 'Escape':
          setShowPago(false)
          setShowSearch(false)
          setShowDescuento(false)
          setShowCierreModal(false)
          setShowTicketPreview(false)
          refocusScanner()
          break

        case 'Delete':
          if (!isInput && selectedItemIdx !== null) {
            const item = activeTab.items[selectedItemIdx]
            if (item) eliminarItem(item.producto.id)
            setSelectedItemIdx(null)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [nextTab, eliminarItem, selectedItemIdx, activeTab.items, refocusScanner, activeShift, activeUser])

  // ── Handler del scanner ──
  const handleScanChange = (val: string) => {
    setScanVal(val)
    setShowAuto(false)
    
    if (!val.trim()) {
      setAutoResults([])
      return
    }

    if (autoDebounce.current) clearTimeout(autoDebounce.current)
    autoDebounce.current = setTimeout(async () => {
      try {
        const { data } = await supabase.rpc('buscar_producto_pos', {
          p_tenant_id: tenantId,
          p_query: val,
          p_limit: 8,
        })
        if (data && data.length > 0) {
          setAutoResults(data as Producto[])
          setAutoIdx(0)
          setShowAuto(true)
        }
      } catch(e) {}
    }, 250)
  }

  const handleScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showAuto && autoResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setAutoIdx(i => Math.min(i + 1, autoResults.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setAutoIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const p = autoResults[autoIdx]
        if (p) {
          startTransition(() => agregarItem(p))
          setScanVal('')
          setShowAuto(false)
          setAutoResults([])
          refocusScanner()
        }
      } else if (e.key === 'Escape') {
        setShowAuto(false)
      }
    }
  }

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeShift) {
      setScanError('Debes abrir turno (caja) antes de escanear productos.')
      setShowAperturaModal(true)
      return
    }

    const codigo = scanVal.trim()
    if (!codigo) return

    setScanVal('')
    setScanError('')

    const result = await escanear(codigo)

    if (result === 'found') {
      setScanFlash('ok')
    } else {
      setScanFlash('error')
      setScanError(`Código "${codigo}" no encontrado. Presiona F2 para buscar.`)
    }

    setTimeout(() => setScanFlash(null), 500)
    refocusScanner()
  }

  // ── Procesar pago ──
  const handlePago = async (pago: PagoPayload) => {
    try {
      const result = await procesarVenta(pago)
      setUltimaVenta(result)
      setShowPago(false)
      setShowTicketPreview(true)
    } catch (err) {
      setScanError((err as Error).message)
      setShowPago(false)
    }
  }

  // ── Imprimir ticket ──
  const handlePrint = () => {
    window.print()
    setShowTicketPreview(false)
    setUltimaVenta(null)
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

  return (
    <div
      className="flex h-screen flex-col bg-zinc-950 text-white select-none overflow-hidden"
      onClick={refocusScanner}
    >
      {/* ── Global App Nav (compact) with operator selector in right slot ── */}
      <AppNavBar
        tenantId={tenantId}
        activeSection="ventas"
        compact
        rightSlot={
          <div className="flex items-center gap-3">
            {/* Shortcut hints */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-600">
              <Kbd k="F1" label="Cobrar" />
              <Kbd k="F2" label="Buscar" />
              <Kbd k="F3" label="Tab" />
              <Kbd k="F4" label="Desc." />
              <Kbd k="F5" label="Turno" />
            </div>
            {/* Operator selector */}
            <div className="flex flex-col items-end text-xs">
              <select
                value={activeUser?.id || ''}
                onChange={(e) => {
                  const found = operadores.find(o => o.id === e.target.value)
                  if (found) setActiveUser(found)
                }}
                onClick={e => e.stopPropagation()}
                className="bg-transparent border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500"
              >
                {operadores.map(op => (
                  <option key={op.id} value={op.id} className="bg-zinc-900 text-white">
                    {op.nombre} ({op.rol})
                  </option>
                ))}
              </select>
              {activeShift ? (
                <span className="text-[10px] text-emerald-400 mt-0.5 font-semibold">Caja Abierta</span>
              ) : (
                <span className="text-[10px] text-amber-500 mt-0.5 font-semibold">Caja Cerrada</span>
              )}
            </div>
          </div>
        }
      />

      {/* ── POS inner header: tabs + scanner ── */}
      <header className="flex items-center gap-4 border-b border-zinc-800 bg-zinc-900 px-4 py-2 shrink-0">
        {/* Tabs de ventas */}
        <div className="flex items-center gap-1">
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              onClick={e => { e.stopPropagation(); setActiveTabIdx(i) }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                i === activeTabIdx
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
              {tab.items.length > 0 && (
                <span className="ml-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-xs text-black font-bold">
                  {tab.items.length}
                </span>
              )}
            </button>
          ))}
          {tabs.length < 3 && (
            <button
              onClick={e => { e.stopPropagation(); addTab() }}
              className="rounded-lg px-2 py-1.5 text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
              title="Nueva venta en espera"
            >
              + F3
            </button>
          )}
        </div>

        {/* Scanner input */}
        <form onSubmit={handleScanSubmit} className="flex-1 max-w-sm relative">
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-all ${
            scanFlash === 'ok'    ? 'border-emerald-500 bg-emerald-950' :
            scanFlash === 'error' ? 'border-red-500 bg-red-950' :
            'border-zinc-700 bg-zinc-800 focus-within:border-zinc-500'
          }`}>
            <span className="text-zinc-500 text-sm">▣</span>
            <input
              ref={scannerRef}
              type="text"
              value={scanVal}
              onChange={e => handleScanChange(e.target.value)}
              onKeyDown={handleScannerKeyDown}
              onClick={e => e.stopPropagation()}
              placeholder={activeShift ? "Escanear código de barras o teclear..." : "⚠️ DEBES ABRIR CAJA F5"}
              autoComplete="off"
              className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
            />
            {isLoading && (
              <span className="text-xs text-zinc-500 animate-pulse">...</span>
            )}
          </div>

          {/* Predictive Search Dropdown */}
          {showAuto && autoResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              {autoResults.map((p, i) => (
                <div
                  key={p.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    startTransition(() => agregarItem(p))
                    setScanVal('')
                    setShowAuto(false)
                    setAutoResults([])
                    refocusScanner()
                  }}
                  className={`px-3 py-2.5 cursor-pointer flex items-center justify-between text-sm transition-colors ${
                    i === autoIdx ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <div className="truncate pr-4 flex-1">
                    <span className="font-medium">{p.descripcion}</span>
                    {p.codigo_barras && <span className="text-xs text-zinc-500 ml-2 font-mono">{p.codigo_barras}</span>}
                  </div>
                  <div className="font-semibold tabular-nums shrink-0">
                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.precio_venta)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </form>

      </header>

      {/* Error banner */}
      {scanError && (
        <div
          className="flex items-center justify-between gap-3 bg-red-950 border-b border-red-900 px-4 py-2 text-xs text-red-400 font-semibold"
          onClick={e => e.stopPropagation()}
        >
          <span>⚠️ {scanError}</span>
          <button onClick={() => setScanError('')} className="text-red-650 hover:text-red-400">✕</button>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Table of items */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {activeTab.items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-zinc-700">
              <div className="text-5xl mb-3">▣</div>
              <p className="text-sm font-medium">Escanea un producto para comenzar</p>
              <p className="text-xs mt-1">o presiona <kbd className="rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.5">F2</kbd> para buscar</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 z-10">
                  <tr className="text-xs text-zinc-500 uppercase tracking-wide">
                    <th className="px-4 py-2.5 text-left font-medium">Producto</th>
                    <th className="px-3 py-2.5 text-right font-medium w-20">Cant.</th>
                    <th className="px-3 py-2.5 text-right font-medium w-28">P. Unit.</th>
                    <th className="px-3 py-2.5 text-right font-medium w-28">Subtotal</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {activeTab.items.map((item, i) => (
                    <tr
                      key={item.producto.id}
                      onClick={e => { e.stopPropagation(); setSelectedItemIdx(i) }}
                      className={`cursor-pointer transition-colors ${
                        selectedItemIdx === i
                          ? 'bg-emerald-950/40 border-l-2 border-l-emerald-500'
                          : 'hover:bg-zinc-800/50'
                      } ${lastAdded === item.producto.id ? 'animate-pulse' : ''}`}
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-white">{item.producto.descripcion}</p>
                        {item.producto.codigo_barras && (
                          <p className="text-xs text-zinc-600 font-mono">{item.producto.codigo_barras}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          min="0.001"
                          step={item.producto.unidad_medida === 'pza' ? '1' : '0.001'}
                          value={item.cantidad}
                          onChange={e => setCantidad(item.producto.id, parseFloat(e.target.value) || 0)}
                          onClick={e => e.stopPropagation()}
                          className="w-16 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-right text-sm text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.precio_aplicado}
                          onChange={e => setPrecio(item.producto.id, parseFloat(e.target.value) || 0)}
                          onClick={e => e.stopPropagation()}
                          className="w-24 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-right text-sm text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-white tabular-nums">
                        {fmt(item.subtotal)}
                      </td>
                      <td className="px-2 py-2.5">
                        <button
                          onClick={e => { e.stopPropagation(); eliminarItem(item.producto.id) }}
                          className="rounded p-1 text-zinc-600 hover:bg-zinc-700 hover:text-red-400 transition-colors"
                          title="Eliminar (Delete)"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-72 shrink-0 border-l border-zinc-800 bg-zinc-900 flex flex-col">
          {/* Totals */}
          <div className="p-4 space-y-2 border-b border-zinc-800">
            <div className="flex justify-between text-sm text-zinc-400">
              <span>Artículos</span>
              <span className="font-medium text-white tabular-nums">{totalItems}</span>
            </div>
            <div className="flex justify-between text-sm text-zinc-400">
              <span>Subtotal</span>
              <span className="font-medium text-white tabular-nums">{fmt(subtotal)}</span>
            </div>
            {activeTab.descuento > 0 && (
              <div className="flex justify-between text-sm text-emerald-500">
                <span>Descuento</span>
                <span className="tabular-nums">-{fmt(activeTab.descuento)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-zinc-800">
              <span className="text-base font-semibold text-white">Total</span>
              <span className="text-2xl font-bold text-emerald-400 tabular-nums">{fmt(total)}</span>
            </div>
          </div>

          {/* Descuento input */}
          {showDescuento && (
            <div
              className="p-4 border-b border-zinc-800 bg-zinc-800/50"
              onClick={e => e.stopPropagation()}
            >
              <label className="text-xs font-medium text-zinc-400">Descuento ($)</label>
              <div className="flex gap-2 mt-1.5">
                <input
                  autoFocus
                  type="number"
                  min="0"
                  step="0.01"
                  value={descInput}
                  onChange={e => setDescInput(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
                <button
                  onClick={() => {
                    setDescuento(parseFloat(descInput) || 0)
                    setShowDescuento(false)
                    setDescInput('')
                    refocusScanner()
                  }}
                  className="rounded-lg bg-emerald-500 px-3 text-sm font-bold text-black hover:bg-emerald-400"
                >
                  ✓
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="p-4 space-y-2 mt-auto">
            <button
              onClick={e => { e.stopPropagation(); setShowSearch(true) }}
              className="w-full rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left px-4 flex justify-between items-center"
            >
              <span>Buscar producto</span>
              <Kbd k="F2" />
            </button>

            <button
              onClick={e => {
                e.stopPropagation()
                if (activeUser?.rol !== 'admin') {
                  setScanError('Solo administradores pueden aplicar descuentos.')
                  return
                }
                setShowDescuento(v => !v)
              }}
              className="w-full rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left px-4 flex justify-between items-center"
            >
              <span>Aplicar descuento</span>
              <Kbd k="F4" />
            </button>

            <button
              onClick={e => {
                e.stopPropagation()
                if (activeShift) {
                  setShowCierreModal(true)
                } else {
                  setShowAperturaModal(true)
                }
              }}
              className="w-full rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left px-4 flex justify-between items-center"
            >
              <span>{activeShift ? 'Cerrar caja' : 'Abrir caja'}</span>
              <Kbd k="F5" />
            </button>

            <button
              onClick={e => { e.stopPropagation(); limpiarTab() }}
              className="w-full rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-red-500 hover:bg-red-950/30 transition-colors"
            >
              Limpiar venta
            </button>

            <button
              disabled={activeTab.items.length === 0 || isLoading}
              onClick={e => {
                e.stopPropagation()
                if (!activeShift) {
                  setShowAperturaModal(true)
                } else {
                  setShowPago(true)
                }
              }}
              className="w-full rounded-xl bg-emerald-500 py-3.5 text-base font-bold text-black hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex justify-between items-center px-4"
            >
              <span>{activeShift ? 'COBRAR' : 'ABRIR CAJA'}</span>
              <Kbd k="F1" dark />
            </button>
          </div>
        </aside>
      </div>

      {/* ── Shift Opening Modal (Apertura) ── */}
      {showAperturaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={handleOpenShift}
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 max-w-sm w-full text-center space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Apertura de Caja</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Operador: <span className="text-zinc-300 font-bold">{activeUser?.nombre}</span>
              </p>
            </div>
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold text-zinc-400">Monto de apertura ($ MXN)</label>
              <input
                autoFocus
                type="number"
                min="0"
                step="0.01"
                value={aperturaCash}
                onChange={e => setAperturaCash(e.target.value)}
                placeholder="100.00"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 py-2.5 text-sm font-bold text-black transition-colors"
            >
              Abrir Turno
            </button>
          </form>
        </div>
      )}

      {/* ── Shift Closing Modal (Cierre) ── */}
      {showCierreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={handleCloseShift}
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 max-w-sm w-full text-center space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-400">
              <LogOut className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Cierre de Caja</h2>
              <p className="text-xs text-zinc-500 mt-1">Terminar el turno activo de {activeUser?.nombre}</p>
            </div>
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold text-zinc-400">Efectivo en caja ($ MXN)</label>
              <input
                autoFocus
                type="number"
                min="0"
                step="0.01"
                required
                value={cierreCash}
                onChange={e => setCierreCash(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold text-zinc-400">Notas u observaciones</label>
              <textarea
                value={cierreNotas}
                onChange={e => setCierreNotas(e.target.value)}
                placeholder="Sobrante/faltante, observaciones..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none h-16 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCierreModal(false)}
                className="flex-1 rounded-xl border border-zinc-800 py-2.5 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-red-500 hover:bg-red-400 py-2.5 text-xs font-bold text-white transition-colors"
              >
                Cerrar Caja
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ticket Preview Modal */}
      {showTicketPreview && ultimaVenta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 max-w-sm w-full">
            <div className="text-center mb-4">
              <p className="text-4xl mb-2">✅</p>
              <h2 className="text-lg font-semibold text-white">¡Venta completada!</h2>
              <p className="text-sm text-zinc-500">Folio #{String(ultimaVenta.folio).padStart(6, '0')}</p>
              {ultimaVenta.cambio > 0 && (
                <div className="mt-3 rounded-xl bg-emerald-950 border border-emerald-800 py-3">
                  <p className="text-xs text-emerald-600">Cambio</p>
                  <p className="text-3xl font-bold text-emerald-400">{fmt(ultimaVenta.cambio)}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowTicketPreview(false); setUltimaVenta(null) }}
                className="flex-1 rounded-xl border border-zinc-850 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800"
              >
                Cerrar
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 rounded-xl bg-zinc-700 py-2.5 text-sm font-medium text-white hover:bg-zinc-600"
              >
                🖨 Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PaymentModal */}
      <PaymentModal
        open={showPago}
        total={total}
        clientes={clientes}
        clienteId={activeTab.cliente_id}
        onClose={() => { setShowPago(false); refocusScanner() }}
        onConfirm={handlePago}
        isLoading={isLoading}
      />

      {/* SearchModal */}
      <SearchModal
        open={showSearch}
        tenantId={tenantId}
        onSelect={producto => {
          startTransition(() => agregarItem(producto))
        }}
        onClose={() => { setShowSearch(false); refocusScanner() }}
      />

      {/* TicketPrint hidden for print layout */}
      <TicketPrint
        ref={ticketRef}
        folio={ultimaVenta?.folio ?? 0}
        fecha={new Date()}
        items={activeTab.items}
        subtotal={subtotal}
        descuento={activeTab.descuento}
        total={total}
        cambio={ultimaVenta?.cambio ?? 0}
        metodoPago="efectivo"
        nombreComercio={MOCK_COMERCIO.nombre}
        rfc={MOCK_COMERCIO.rfc}
        cajero={activeUser?.nombre || ''}
        anchoMm={80}
      />
    </div>
  )
}

function Kbd({ k, label, dark }: { k: string; label?: string; dark?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      {label && <span className="text-xs">{label}</span>}
      <kbd className={`rounded border px-1.5 py-0.5 text-xs font-mono ${
        dark
          ? 'border-black/30 bg-black/20 text-black/60'
          : 'border-zinc-700 bg-zinc-800 text-zinc-500'
      }`}>{k}</kbd>
    </span>
  )
}
