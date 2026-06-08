// =============================================================
//  lib/hooks/useRealtime.ts
//  Suscripción en tiempo real a cambios de stock (Supabase Realtime).
//  Alimenta el widget de alertas del dashboard.
// =============================================================
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ProductoBajoStock } from '@/types/pos.types'

export function useLowStockAlerts(tenantId: string) {
  const supabase = createClient()
  const [alerts, setAlerts] = useState<ProductoBajoStock[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newAlert, setNewAlert] = useState<ProductoBajoStock | null>(null)

  // Carga inicial
  const fetchAlerts = useCallback(async () => {
    const { data, error } = await supabase
      .from('productos_bajo_stock')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('nivel_alerta', { ascending: true })  // sin_stock primero

    if (!error && data) {
      setAlerts(data as ProductoBajoStock[])
    }
    setIsLoading(false)
  }, [supabase, tenantId])

  useEffect(() => {
    fetchAlerts()

    // Suscripción Realtime: escucha UPDATE en productos del tenant
    const channel = supabase
      .channel(`stock-alerts-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'productos',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const p = payload.new as {
            id: string
            tenant_id: string
            descripcion: string
            codigo_barras: string | null
            stock_actual: number
            stock_minimo: number
            unidad_medida: string
            activo: boolean
          }

          if (!p.activo) return

          setAlerts(prev => {
            const esBajo = p.stock_actual <= p.stock_minimo
            const nivel =
              p.stock_actual === 0
                ? 'sin_stock'
                : p.stock_actual < p.stock_minimo
                ? 'critico'
                : 'bajo'

            if (!esBajo) {
              // Ya no está en alerta → remover
              return prev.filter(a => a.id !== p.id)
            }

            const alerta: ProductoBajoStock = {
              id: p.id,
              tenant_id: p.tenant_id,
              descripcion: p.descripcion,
              codigo_barras: p.codigo_barras,
              stock_actual: p.stock_actual,
              stock_minimo: p.stock_minimo,
              unidad_medida: p.unidad_medida as ProductoBajoStock['unidad_medida'],
              nombre_categoria: null,
              nivel_alerta: nivel,
            }

            const idx = prev.findIndex(a => a.id === p.id)
            const next = idx >= 0
              ? prev.map((a, i) => (i === idx ? alerta : a))
              : [alerta, ...prev]

            // Flash de nueva alerta para notificación visual
            if (idx < 0) setNewAlert(alerta)

            return next
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, tenantId, fetchAlerts])

  // Limpiar flash después de la animación
  useEffect(() => {
    if (!newAlert) return
    const t = setTimeout(() => setNewAlert(null), 3000)
    return () => clearTimeout(t)
  }, [newAlert])

  const sinStock = alerts.filter(a => a.nivel_alerta === 'sin_stock')
  const criticos  = alerts.filter(a => a.nivel_alerta === 'critico')
  const bajos     = alerts.filter(a => a.nivel_alerta === 'bajo')

  return { alerts, sinStock, criticos, bajos, isLoading, newAlert }
}
