// =============================================================
//  components/pos/PaymentModal.tsx
//  Modal de cobro — F1. Soporta efectivo, tarjeta, mixto, crédito.
// =============================================================
'use client'

import { useState, useEffect, useRef } from 'react'
import type { MetodoPago, PagoPayload, Cliente } from '@/types/pos.types'

interface PaymentModalProps {
  open: boolean
  total: number
  clientes: Cliente[]
  clienteId: string | null
  onClose: () => void
  onConfirm: (pago: PagoPayload) => Promise<void>
  isLoading: boolean
}

const METODOS: { value: MetodoPago; label: string; icon: string }[] = [
  { value: 'efectivo',     label: 'Efectivo',      icon: '💵' },
  { value: 'tarjeta',      label: 'Tarjeta',        icon: '💳' },
  { value: 'mixto',        label: 'Mixto',          icon: '⚡' },
  { value: 'credito',      label: 'Crédito',        icon: '📋' },
  { value: 'transferencia',label: 'Transferencia',  icon: '🔄' },
]

export function PaymentModal({
  open, total, clientes, clienteId, onClose, onConfirm, isLoading
}: PaymentModalProps) {
  const [metodo, setMetodo]             = useState<MetodoPago>('efectivo')
  const [montoEfectivo, setMontoEfectivo] = useState('')
  const [montoTarjeta, setMontoTarjeta]   = useState('')
  const [descuento, setDescuento]         = useState('')
  const [clienteSel, setClienteSel]       = useState(clienteId ?? '')
  const [error, setError]                 = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus al abrir
  useEffect(() => {
    if (open) {
      setMontoEfectivo(total.toFixed(2))
      setMontoTarjeta('')
      setDescuento('')
      setError('')
      setMetodo('efectivo')
      setTimeout(() => inputRef.current?.select(), 50)
    }
  }, [open, total])

  const totalConDesc = Math.max(0, total - (parseFloat(descuento) || 0))
  const efectivo  = parseFloat(montoEfectivo) || 0
  const tarjeta   = parseFloat(montoTarjeta) || 0
  const cambio    = Math.max(0, efectivo + tarjeta - totalConDesc)
  const faltante  = Math.max(0, totalConDesc - efectivo - tarjeta)

  const handleConfirm = async () => {
    setError('')

    if (metodo === 'credito' && !clienteSel) {
      setError('Selecciona un cliente para venta a crédito.')
      return
    }
    if (metodo !== 'credito' && efectivo + tarjeta < totalConDesc - 0.01) {
      setError(`Falta $${faltante.toFixed(2)} para completar el pago.`)
      return
    }

    await onConfirm({
      metodo_pago: metodo,
      monto_efectivo: efectivo,
      monto_tarjeta: tarjeta,
      cliente_id: clienteSel || null,
      descuento: parseFloat(descuento) || 0,
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Modal de cobro"
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">Cobrar venta</h2>
            <p className="text-sm text-zinc-400">F1 para confirmar · Esc para cancelar</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Total */}
        <div className="mb-5 rounded-xl bg-zinc-800 px-5 py-4 text-center">
          {parseFloat(descuento) > 0 && (
            <p className="text-xs text-zinc-500 line-through">${total.toFixed(2)}</p>
          )}
          <p className="text-4xl font-bold tracking-tight text-emerald-400">
            ${totalConDesc.toFixed(2)}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">total a cobrar</p>
        </div>

        {/* Método de pago */}
        <div className="mb-4 grid grid-cols-5 gap-1.5">
          {METODOS.map(m => (
            <button
              key={m.value}
              onClick={() => setMetodo(m.value)}
              className={`flex flex-col items-center gap-1 rounded-lg py-2 px-1 text-xs font-medium transition-all ${
                metodo === m.value
                  ? 'bg-emerald-500 text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
              }`}
            >
              <span className="text-base">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          {/* Descuento */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Descuento ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={descuento}
              onChange={e => setDescuento(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {(metodo === 'efectivo' || metodo === 'mixto') && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Efectivo recibido</label>
              <input
                ref={inputRef}
                type="number"
                min="0"
                step="0.01"
                value={montoEfectivo}
                onChange={e => setMontoEfectivo(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-lg font-semibold text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}

          {(metodo === 'tarjeta' || metodo === 'mixto') && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Monto tarjeta</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={montoTarjeta}
                onChange={e => setMontoTarjeta(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-lg font-semibold text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}

          {metodo === 'credito' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Cliente</label>
              <select
                value={clienteSel}
                onChange={e => setClienteSel(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="">— Seleccionar cliente —</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} (saldo: ${c.saldo_pendiente.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Cambio / faltante */}
        {metodo !== 'tarjeta' && metodo !== 'credito' && metodo !== 'transferencia' && (
          <div className={`mt-4 rounded-xl px-4 py-3 text-center ${
            faltante > 0 ? 'bg-red-950 border border-red-800' : 'bg-zinc-800'
          }`}>
            {faltante > 0 ? (
              <p className="text-sm font-semibold text-red-400">Falta: ${faltante.toFixed(2)}</p>
            ) : (
              <>
                <p className="text-xs text-zinc-500">Cambio</p>
                <p className="text-2xl font-bold text-white">${cambio.toFixed(2)}</p>
              </>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="mt-3 rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        {/* Botones */}
        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-zinc-700 py-3 text-sm font-medium text-zinc-400 hover:bg-zinc-800 transition-colors"
          >
            Cancelar (Esc)
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-[2] rounded-xl bg-emerald-500 py-3 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {isLoading ? 'Procesando...' : `Confirmar cobro · F1`}
          </button>
        </div>
      </div>
    </div>
  )
}
