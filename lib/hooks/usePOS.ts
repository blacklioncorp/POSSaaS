// =============================================================
//  lib/hooks/usePOS.ts
//  Hook central del punto de venta.
//  Maneja carrito, tabs múltiples, búsqueda y procesamiento.
// =============================================================
'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  Producto,
  ItemCarrito,
  SaleTab,
  PagoPayload,
  VentaResult,
  Cliente,
} from '@/types/pos.types'

const createTab = (n: number): SaleTab => ({
  id: `venta-${n}`,
  label: `Venta ${n}`,
  items: [],
  cliente_id: null,
  descuento: 0,
})

const MAX_TABS = 3

export function usePOS(tenantId: string, usuarioId: string, turnoId: string | null) {
  const supabase = createClient()

  // ── Tabs / ventas en espera ──────────────────────────────
  const [tabs, setTabs] = useState<SaleTab[]>([createTab(1)])
  const [activeTabIdx, setActiveTabIdx] = useState(0)
  const activeTab = tabs[activeTabIdx]

  // ── UI state ─────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false)
  const [lastAdded, setLastAdded] = useState<string | null>(null) // producto_id para animación

  // Cache local de productos buscados en esta sesión
  const productCache = useRef<Map<string, Producto>>(new Map())

  // ── Búsqueda de producto ─────────────────────────────────
  const buscarProducto = useCallback(async (query: string): Promise<Producto | null> => {
    const q = query.trim()
    if (!q) return null

    // 1. Revisar caché local primero (velocidad SICAR)
    const cached = productCache.current.get(q)
    if (cached) return cached

    const { data, error } = await supabase.rpc('buscar_producto_pos', {
      p_tenant_id: tenantId,
      p_query: q,
      p_limit: 1,
    })

    if (error || !data || data.length === 0) return null

    const producto = data[0] as Producto
    // Cachear por código de barras Y por descripción
    if (producto.codigo_barras) productCache.current.set(producto.codigo_barras, producto)
    productCache.current.set(producto.id, producto)
    return producto
  }, [supabase, tenantId])

  // ── Agregar / incrementar ítem ───────────────────────────
  const agregarItem = useCallback((producto: Producto, cantidad = 1) => {
    setTabs(prev => prev.map((tab, i) => {
      if (i !== activeTabIdx) return tab

      const existingIdx = tab.items.findIndex(it => it.producto.id === producto.id)
      let items: ItemCarrito[]

      if (existingIdx >= 0) {
        // Incrementar cantidad existente
        items = tab.items.map((it, idx) => {
          if (idx !== existingIdx) return it
          const nuevaCantidad = it.cantidad + cantidad
          return {
            ...it,
            cantidad: nuevaCantidad,
            subtotal: nuevaCantidad * it.precio_aplicado,
          }
        })
      } else {
        // Nuevo ítem
        const precio = producto.precio_venta
        items = [...tab.items, {
          producto,
          cantidad,
          precio_aplicado: precio,
          subtotal: cantidad * precio,
        }]
      }

      return { ...tab, items }
    }))

    setLastAdded(producto.id)
    setTimeout(() => setLastAdded(null), 600)
  }, [activeTabIdx])

  // ── Escanear (entrada del lector de barras) ──────────────
  const escanear = useCallback(async (codigo: string): Promise<'found' | 'not_found'> => {
    setIsLoading(true)
    try {
      const producto = await buscarProducto(codigo)
      if (!producto) return 'not_found'
      agregarItem(producto)
      return 'found'
    } finally {
      setIsLoading(false)
    }
  }, [buscarProducto, agregarItem])

  // ── Modificar cantidad / precio / eliminar ───────────────
  const setCantidad = useCallback((productoId: string, cantidad: number) => {
    if (cantidad <= 0) {
      eliminarItem(productoId)
      return
    }
    setTabs(prev => prev.map((tab, i) => {
      if (i !== activeTabIdx) return tab
      return {
        ...tab,
        items: tab.items.map(it => {
          if (it.producto.id !== productoId) return it
          return { ...it, cantidad, subtotal: cantidad * it.precio_aplicado }
        }),
      }
    }))
  }, [activeTabIdx])

  const setPrecio = useCallback((productoId: string, precio: number) => {
    setTabs(prev => prev.map((tab, i) => {
      if (i !== activeTabIdx) return tab
      return {
        ...tab,
        items: tab.items.map(it => {
          if (it.producto.id !== productoId) return it
          return { ...it, precio_aplicado: precio, subtotal: it.cantidad * precio }
        }),
      }
    }))
  }, [activeTabIdx])

  const eliminarItem = useCallback((productoId: string) => {
    setTabs(prev => prev.map((tab, i) => {
      if (i !== activeTabIdx) return tab
      return { ...tab, items: tab.items.filter(it => it.producto.id !== productoId) }
    }))
  }, [activeTabIdx])

  const setDescuento = useCallback((descuento: number) => {
    setTabs(prev => prev.map((tab, i) => {
      if (i !== activeTabIdx) return tab
      return { ...tab, descuento }
    }))
  }, [activeTabIdx])

  const setCliente = useCallback((clienteId: string | null) => {
    setTabs(prev => prev.map((tab, i) => {
      if (i !== activeTabIdx) return tab
      return { ...tab, cliente_id: clienteId }
    }))
  }, [activeTabIdx])

  const limpiarTab = useCallback(() => {
    setTabs(prev => prev.map((tab, i) => {
      if (i !== activeTabIdx) return tab
      return { ...tab, items: [], cliente_id: null, descuento: 0 }
    }))
  }, [activeTabIdx])

  // ── Tabs ─────────────────────────────────────────────────
  const addTab = useCallback(() => {
    if (tabs.length >= MAX_TABS) return
    const n = tabs.length + 1
    setTabs(prev => [...prev, createTab(n)])
    setActiveTabIdx(tabs.length)
  }, [tabs.length])

  const nextTab = useCallback(() => {
    setActiveTabIdx(i => (i + 1) % tabs.length)
  }, [tabs.length])

  // ── Totales ──────────────────────────────────────────────
  const subtotal = activeTab.items.reduce((s, it) => s + it.subtotal, 0)
  const total = Math.max(0, subtotal - activeTab.descuento)
  const totalItems = activeTab.items.reduce((s, it) => s + it.cantidad, 0)

  // ── Procesar pago ─────────────────────────────────────────
  const procesarVenta = useCallback(async (pago: PagoPayload): Promise<VentaResult> => {
    if (activeTab.items.length === 0) throw new Error('El carrito está vacío')

    setIsLoading(true)
    try {
      const items = activeTab.items.map(it => ({
        producto_id: it.producto.id,
        cantidad: it.cantidad,
        precio_aplicado: it.precio_aplicado,
      }))

      const { data, error } = await supabase.rpc('procesar_venta', {
        p_tenant_id: tenantId,
        p_usuario_id: usuarioId,
        p_cliente_id: pago.cliente_id,
        p_turno_id: turnoId,
        p_metodo_pago: pago.metodo_pago,
        p_monto_efectivo: pago.monto_efectivo,
        p_monto_tarjeta: pago.monto_tarjeta,
        p_descuento: pago.descuento,
        p_items: items,
      })

      if (error) throw new Error(error.message)

      // Limpiar tab tras venta exitosa
      limpiarTab()

      // Invalidar caché de productos vendidos (stock cambió)
      items.forEach(it => productCache.current.delete(it.producto_id))

      return data as VentaResult
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, supabase, tenantId, usuarioId, turnoId, limpiarTab])

  return {
    // State
    tabs,
    activeTabIdx,
    activeTab,
    isLoading,
    lastAdded,
    // Totals
    subtotal,
    total,
    totalItems,
    // Actions
    escanear,
    buscarProducto,
    agregarItem,
    setCantidad,
    setPrecio,
    eliminarItem,
    setDescuento,
    setCliente,
    limpiarTab,
    addTab,
    nextTab,
    setActiveTabIdx,
    procesarVenta,
  }
}
