// =============================================================
//  components/dashboard/LowStockWidget.tsx
//  Widget de alertas de bajo stock con Supabase Realtime.
//  Muestra badges rojo/amarillo animados en tiempo real.
// =============================================================
'use client'

import { useLowStockAlerts } from '@/lib/hooks/useRealtime'
import type { ProductoBajoStock } from '@/types/pos.types'

interface LowStockWidgetProps {
  tenantId: string
}

export function LowStockWidget({ tenantId }: LowStockWidgetProps) {
  const { alerts, sinStock, criticos, bajos, isLoading, newAlert } = useLowStockAlerts(tenantId)

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 rounded bg-zinc-800" />
          <div className="h-10 w-full rounded bg-zinc-800" />
          <div className="h-10 w-full rounded bg-zinc-800" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          {/* Indicador de conexión en vivo */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <h3 className="text-sm font-semibold text-white">Alertas de stock</h3>
        </div>

        {/* Contadores resumen */}
        <div className="flex items-center gap-2">
          {sinStock.length > 0 && (
            <Badge count={sinStock.length} variant="red" label="sin stock" />
          )}
          {criticos.length > 0 && (
            <Badge count={criticos.length} variant="amber" label="crítico" />
          )}
          {bajos.length > 0 && (
            <Badge count={bajos.length} variant="yellow" label="bajo" />
          )}
          {alerts.length === 0 && (
            <span className="text-xs text-emerald-500 font-medium">Todo en orden ✓</span>
          )}
        </div>
      </div>

      {/* Nueva alerta flash */}
      {newAlert && (
        <div className="animate-in slide-in-from-top-2 duration-300 mx-3 mt-3 rounded-xl bg-red-950 border border-red-800 px-4 py-2.5">
          <p className="text-xs font-semibold text-red-400">
            ⚠ Nueva alerta: <span className="text-white">{newAlert.descripcion}</span>
          </p>
          <p className="text-xs text-red-500">
            Stock: {newAlert.stock_actual} / Mínimo: {newAlert.stock_minimo} {newAlert.unidad_medida}
          </p>
        </div>
      )}

      {/* Lista */}
      {alerts.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-2xl mb-1">✅</p>
          <p className="text-sm text-zinc-500">Todos los productos con stock suficiente</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/60 max-h-80 overflow-y-auto">
          {/* Sin stock primero */}
          {sinStock.map(p => <AlertRow key={p.id} producto={p} />)}
          {criticos.map(p => <AlertRow key={p.id} producto={p} />)}
          {bajos.map(p => <AlertRow key={p.id} producto={p} />)}
        </div>
      )}

      {/* Footer */}
      {alerts.length > 0 && (
        <div className="border-t border-zinc-800 px-5 py-2.5">
          <p className="text-xs text-zinc-600">
            {alerts.length} producto{alerts.length > 1 ? 's' : ''} requieren atención
            · Actualización en tiempo real
          </p>
        </div>
      )}
    </div>
  )
}

// ── Fila de alerta individual ────────────────────────────────
function AlertRow({ producto: p }: { producto: ProductoBajoStock }) {
  const isSinStock = p.nivel_alerta === 'sin_stock'
  const isCritico  = p.nivel_alerta === 'critico'

  const stockColor = isSinStock
    ? 'text-red-400'
    : isCritico
    ? 'text-amber-400'
    : 'text-yellow-400'

  const barWidth = p.stock_minimo > 0
    ? Math.min(100, (p.stock_actual / p.stock_minimo) * 100)
    : 0

  const barColor = isSinStock
    ? 'bg-red-500'
    : isCritico
    ? 'bg-amber-500'
    : 'bg-yellow-500'

  return (
    <div className={`flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/50 transition-colors ${
      isSinStock ? 'bg-red-950/20' : ''
    }`}>
      {/* Indicador de nivel */}
      <div className={`shrink-0 w-1.5 h-8 rounded-full ${barColor}`} />

      {/* Info producto */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{p.descripcion}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {p.codigo_barras && (
            <span className="text-xs font-mono text-zinc-600">{p.codigo_barras}</span>
          )}
          {p.nombre_categoria && (
            <span className="text-xs text-zinc-600 truncate">{p.nombre_categoria}</span>
          )}
        </div>
        {/* Mini barra de progreso de stock */}
        <div className="mt-1.5 h-1 w-full rounded-full bg-zinc-800">
          <div
            className={`h-1 rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* Stock actual/mínimo */}
      <div className="shrink-0 text-right">
        <p className={`text-sm font-bold tabular-nums ${stockColor}`}>
          {p.stock_actual}
        </p>
        <p className="text-xs text-zinc-600">/ {p.stock_minimo} {p.unidad_medida}</p>
      </div>

      {/* Badge de nivel */}
      <div className="shrink-0">
        {isSinStock && (
          <span className="rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-xs font-semibold text-red-400">
            Agotado
          </span>
        )}
        {isCritico && (
          <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-xs font-semibold text-amber-400">
            Crítico
          </span>
        )}
        {p.nivel_alerta === 'bajo' && (
          <span className="rounded-full bg-yellow-500/20 border border-yellow-500/40 px-2 py-0.5 text-xs font-semibold text-yellow-400">
            Bajo
          </span>
        )}
      </div>
    </div>
  )
}

// ── Badge contador ───────────────────────────────────────────
function Badge({
  count, variant, label,
}: {
  count: number
  variant: 'red' | 'amber' | 'yellow'
  label: string
}) {
  const styles = {
    red:    'bg-red-500/20 border-red-500/40 text-red-400',
    amber:  'bg-amber-500/20 border-amber-500/40 text-amber-400',
    yellow: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
  }
  return (
    <span
      title={`${count} producto${count > 1 ? 's' : ''} ${label}`}
      className={`rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums ${styles[variant]}`}
    >
      {count}
    </span>
  )
}
