// =============================================================
//  app/(tenant)/[tenantId]/ventas/page.tsx
//  Pantalla de ventas ultra-rápida estilo SICAR.
//
//  Atajos de teclado:
//    F1 → Modal de cobro
//    F2 → Búsqueda manual
//    F3 → Cambiar tab de venta
//    F4 → Aplicar descuento (solo admin)
//    F5 → Cierre de turno
//    Esc → Cerrar modales
//    Delete → Eliminar ítem seleccionado en tabla
// =============================================================
'use client'

import {
  useEffect, useRef, useState, useCallback, useTransition
} from 'react'
import { usePOS } from '@/lib/hooks/usePOS'
import { PaymentModal }  from '@/components/pos/PaymentModal'
import { SearchModal }   from '@/components/pos/SearchModal'
import { TicketPrint }   from '@/components/pos/TicketPrint'
import type {
  PagoPayload, VentaResult, Cliente, Usuario
} from '@/types/pos.types'

// ── Props (en producción vendrían de cookies / server component) ──
interface VentasPageProps {
  params: { tenantId: string }
}

// Mock de contexto — reemplazar con useSession / server cookie
const MOCK_USUARIO: Usuario = {
  id: 'usr-001', tenant_id: '', nombre: 'Admin Demo', rol: 'admin'
}
const MOCK_TURNO_ID = 'turno-001'
const MOCK_COMERCIO = { nombre: 'Abarrotes Demo SA', rfc: 'ABAR010101ABC' }

export default function VentasPage({ params }: VentasPageProps) {
  const { tenantId } = params

  const {
    tabs, activeTabIdx, activeTab, isLoading, lastAdded,
    subtotal, total, totalItems,
    escanear, buscarProducto, agregarItem,
    setCantidad, setPrecio, eliminarItem,
    setDescuento, setCliente, limpiarTab,
    addTab, nextTab, setActiveTabIdx,
    procesarVenta,
  } = usePOS(tenantId, MOCK_USUARIO.id, MOCK_TURNO_ID)

  // ── Modales ──────────────────────────────────────────────
  const [showPago, setShowPago]           = useState(false)
  const [showSearch, setShowSearch]       = useState(false)
  const [showDescuento, setShowDescuento] = useState(false)
  const [showTurno, setShowTurno]         = useState(false)

  // ── Post-venta ───────────────────────────────────────────
  const [ultimaVenta, setUltimaVenta]       = useState<VentaResult | null>(null)
  const [showTicketPreview, setShowTicketPreview] = useState(false)
  const ticketRef = useRef<HTMLDivElement>(null)

  // ── Scanner input ────────────────────────────────────────
  const scannerRef    = useRef<HTMLInputElement>(null)
  const [scanVal, setScanVal]     = useState('')
  const [scanError, setScanError] = useState('')
  const [scanFlash, setScanFlash] = useState<'ok' | 'error' | null>(null)

  // ── Clientes (cargar una vez) ────────────────────────────
  const [clientes, setClientes] = useState<Cliente[]>([])

  // ── Ítem seleccionado en tabla ───────────────────────────
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null)

  // ── Descuento input ──────────────────────────────────────
  const [descInput, setDescInput] = useState('')

  const [, startTransition] = useTransition()

  // ── Mantener foco en el scanner siempre ──────────────────
  const refocusScanner = useCallback(() => {
    // No refocus si hay un modal abierto
    if (showPago || showSearch || showDescuento) return
    scannerRef.current?.focus()
  }, [showPago, showSearch, showDescuento])

  useEffect(() => {
    const t = setTimeout(refocusScanner, 100)
    return () => clearTimeout(t)
  })

  // ── Atajos de teclado globales ───────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Ignorar si estamos escribiendo en un input que no es el scanner
      const tag = (e.target as HTMLElement).tagName
      const isScanner = e.target === scannerRef.current
      const isInput = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && !isScanner

      switch (e.key) {
        case 'F1':
          e.preventDefault()
          if (!isInput) setShowPago(v => !v)
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
            if (MOCK_USUARIO.rol !== 'admin') {
              setScanError('Solo administradores pueden aplicar descuentos.')
              return
            }
            setShowDescuento(v => !v)
          }
          break

        case 'F5':
          e.preventDefault()
          if (!isInput) setShowTurno(true)
          break

        case 'Escape':
          setShowPago(false)
          setShowSearch(false)
          setShowDescuento(false)
          setShowTurno(false)
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
  }, [nextTab, eliminarItem, selectedItemIdx, activeTab.items, refocusScanner])

  // ── Handler del scanner ──────────────────────────────────
  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const codigo = scanVal.trim()
    if (!codigo) return

    setScanVal('')
    setScanError('')

    const result = await escanear(codigo)

    if (result === 'found') {
      setScanFlash('ok')
    } else {
      setScanFlash('error')
      setScanError(`Código "${codigo}" no encontrado. Presiona F2 para buscar o registrar.`)
    }

    setTimeout(() => setScanFlash(null), 500)
    refocusScanner()
  }

  // ── Procesar pago ────────────────────────────────────────
  const handlePago = async (pago: PagoPayload) => {
    try {
      const result = await procesarVenta(pago)
      setUltimaVenta(result)
      setShowPago(false)
      setShowTicketPreview(true)
    } catch (err) {
      // El error ya viene con mensaje legible del trigger SQL
      setScanError((err as Error).message)
      setShowPago(false)
    }
  }

  // ── Imprimir ticket ──────────────────────────────────────
  const handlePrint = () => {
    window.print()
    setShowTicketPreview(false)
    setUltimaVenta(null)
  }

  // ── Formatear moneda ─────────────────────────────────────
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

  // ─────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-screen flex-col bg-zinc-950 text-white select-none overflow-hidden"
      onClick={refocusScanner}
    >
      {/* ── Top bar ── */}
      <header className="flex items-center gap-4 border-b border-zinc-800 bg-zinc-900 px-4 py-2 shrink-0">
        {/* Tabs de ventas (F3) */}
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

        {/* Scanner input — siempre con foco */}
        <form onSubmit={handleScanSubmit} className="flex-1 max-w-sm">
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
              onChange={e => setScanVal(e.target.value)}
              onClick={e => e.stopPropagation()}
              placeholder="Escanear código de barras..."
              autoComplete="off"
              className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
            />
            {isLoading && (
              <span className="text-xs text-zinc-500 animate-pulse">...</span>
            )}
          </div>
        </form>

        {/* Shortcut hints */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-zinc-600">
          <Kbd k="F1" label="Cobrar" />
          <Kbd k="F2" label="Buscar" />
          <Kbd k="F3" label="Tab" />
          <Kbd k="F4" label="Desc." />
          <Kbd k="F5" label="Turno" />
        </div>

        {/* Usuario */}
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-zinc-500">{MOCK_USUARIO.nombre}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            MOCK_USUARIO.rol === 'admin'
              ? 'bg-purple-500/20 text-purple-300'
              : 'bg-zinc-700 text-zinc-300'
          }`}>{MOCK_USUARIO.rol}</span>
        </div>
      </header>

      {/* ── Error banner ── */}
      {scanError && (
        <div
          className="flex items-center justify-between gap-3 bg-red-950 border-b border-red-900 px-4 py-2 text-xs text-red-400"
          onClick={e => e.stopPropagation()}
        >
          <span>⚠ {scanError}</span>
          <button onClick={() => setScanError('')} className="text-red-600 hover:text-red-400">✕</button>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Tabla de carrito ── */}
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

        {/* ── Panel lateral de totales ── */}
        <aside className="w-72 shrink-0 border-l border-zinc-800 bg-zinc-900 flex flex-col">

          {/* Totales */}
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

          {/* Descuento inline (F4) */}
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

          {/* Acciones */}
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
                if (MOCK_USUARIO.rol !== 'admin') {
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
              onClick={e => { e.stopPropagation(); limpiarTab() }}
              className="w-full rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-red-500 hover:bg-red-950/30 transition-colors"
            >
              Limpiar venta
            </button>

            <button
              disabled={activeTab.items.length === 0 || isLoading}
              onClick={e => { e.stopPropagation(); setShowPago(true) }}
              className="w-full rounded-xl bg-emerald-500 py-3.5 text-base font-bold text-black hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex justify-between items-center px-4"
            >
              <span>COBRAR</span>
              <Kbd k="F1" dark />
            </button>
          </div>
        </aside>
      </div>

      {/* ── Cierre de turno overlay (F5) ── */}
      {showTurno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-8 max-w-sm w-full text-center">
            <p className="text-4xl mb-4">🔒</p>
            <h2 className="text-lg font-semibold text-white mb-1">Cierre de turno</h2>
            <p className="text-sm text-zinc-500 mb-6">Esta acción cerrará el turno activo y generará el resumen de caja.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTurno(false)}
                className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-400">
                Cerrar turno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Post-venta: preview ticket ── */}
      {showTicketPreview && ultimaVenta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6 max-w-sm w-full">
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
                className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800"
              >
                Cerrar
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 rounded-xl bg-zinc-700 py-2.5 text-sm font-medium text-white hover:bg-zinc-600"
              >
                🖨 Imprimir ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modales ── */}
      <PaymentModal
        open={showPago}
        total={total}
        clientes={clientes}
        clienteId={activeTab.cliente_id}
        onClose={() => { setShowPago(false); refocusScanner() }}
        onConfirm={handlePago}
        isLoading={isLoading}
      />

      <SearchModal
        open={showSearch}
        tenantId={tenantId}
        onSelect={producto => {
          startTransition(() => agregarItem(producto))
        }}
        onClose={() => { setShowSearch(false); refocusScanner() }}
      />

      {/* Ticket oculto para impresión */}
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
        cajero={MOCK_USUARIO.nombre}
        anchoMm={80}
      />
    </div>
  )
}

// ── Helper: tecla de atajo ───────────────────────────────────
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
