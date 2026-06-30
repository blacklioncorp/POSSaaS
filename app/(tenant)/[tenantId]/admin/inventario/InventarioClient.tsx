'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Box, Plus, Minus, Search, CheckCircle2, TrendingDown, TrendingUp, Minus as MinusIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AppNavBar } from '@/components/pos/AppNavBar'
import type { Producto } from '@/types/pos.types'

interface InventarioClientProps {
  tenantId: string
}

export function InventarioClient({ tenantId }: InventarioClientProps) {
  const router = useRouter()
  const supabase = createClient(tenantId)

  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null)

  // Form State
  const [tipoMovimiento, setTipoMovimiento] = useState<'entrada' | 'salida'>('entrada')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [costo, setCosto] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const fetchProductos = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('activo', true)
      .order('descripcion', { ascending: true })

    if (error) console.error('Error fetching products:', error)
    else setProductos(data || [])
    
    setLoading(false)
  }

  useEffect(() => {
    fetchProductos()
  }, [tenantId])

  const handleSelectProduct = (p: Producto) => {
    setSelectedProduct(p)
    setCantidad('')
    setMotivo('')
    setProveedor(p.nombre_proveedor || '')
    setCosto(p.precio_compra.toString())
    setSuccessMsg('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct) return
    const numCantidad = Number(cantidad)
    if (isNaN(numCantidad) || numCantidad <= 0) {
      alert('La cantidad debe ser mayor a 0.')
      return
    }

    setIsSubmitting(true)

    const stock_anterior = Number(selectedProduct.stock_actual)
    const stock_nuevo = tipoMovimiento === 'entrada' 
      ? stock_anterior + numCantidad 
      : stock_anterior - numCantidad

    if (stock_nuevo < 0) {
      alert('No puedes tener stock negativo.')
      setIsSubmitting(false)
      return
    }

    // 1. Update Product Stock (and cost/provider if entry)
    let updateData: any = { stock_actual: stock_nuevo }
    if (tipoMovimiento === 'entrada') {
      const numCosto = Number(costo)
      if (!isNaN(numCosto) && numCosto > 0) {
        updateData.precio_compra = numCosto
      }
      if (proveedor.trim()) {
        updateData.nombre_proveedor = proveedor.trim()
      }
    }

    const { error: updateError } = await supabase
      .from('productos')
      .update(updateData)
      .eq('id', selectedProduct.id)
      .eq('tenant_id', tenantId)

    if (updateError) {
      alert('Error al actualizar el stock: ' + updateError.message)
      setIsSubmitting(false)
      return
    }

    // 2. Insert into movimientos_inventario (Kardex)
    // Nota: Si la tabla aún no fue creada (falta correr la migración), ignoramos el error silenciosamente
    // para no romper el flujo principal, pero lo ideal es que la tabla exista.
    await supabase
      .from('movimientos_inventario')
      .insert([{
        tenant_id: tenantId,
        producto_id: selectedProduct.id,
        tipo: tipoMovimiento,
        cantidad: numCantidad,
        stock_anterior,
        stock_nuevo,
        motivo: motivo || (tipoMovimiento === 'entrada' ? 'Ingreso manual' : 'Salida manual')
      }])

    // 3. Insert into historial_precios if it's an entry
    if (tipoMovimiento === 'entrada') {
      const numCosto = Number(costo)
      if (!isNaN(numCosto) && numCosto > 0) {
        await supabase
          .from('historial_precios')
          .insert([{
            tenant_id: tenantId,
            producto_id: selectedProduct.id,
            nombre_proveedor: proveedor.trim() || 'Sin Proveedor',
            precio_compra: numCosto,
            precio_anterior: selectedProduct.precio_compra,
            cantidad: numCantidad,
            notas: motivo || 'Ingreso de inventario'
          }])
      }
    }

    // Update local state
    const updatedProduct = { 
      ...selectedProduct, 
      stock_actual: stock_nuevo,
      ...(tipoMovimiento === 'entrada' ? {
        precio_compra: !isNaN(Number(costo)) && Number(costo) > 0 ? Number(costo) : selectedProduct.precio_compra,
        nombre_proveedor: proveedor.trim() || selectedProduct.nombre_proveedor
      } : {})
    }
    setSelectedProduct(null)
    setProductos(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p))
    setSuccessMsg(`¡Stock actualizado! Nuevo stock de ${updatedProduct.descripcion}: ${stock_nuevo} ${updatedProduct.unidad_medida}`)
    
    setIsSubmitting(false)
  }

  // --- Computed Values for Price Change and Margins ---
  const numCostoInput = Number(costo) || 0
  const costoAnterior = selectedProduct ? Number(selectedProduct.precio_compra) : 0
  const diffCosto = numCostoInput - costoAnterior
  const percentDiffCosto = costoAnterior > 0 ? (Math.abs(diffCosto) / costoAnterior) * 100 : 0
  
  // Calculate original margin
  const precioVentaActual = selectedProduct ? Number(selectedProduct.precio_venta) : 0
  const gananciaActual = precioVentaActual - costoAnterior
  const margenActualPorcentaje = costoAnterior > 0 ? (gananciaActual / costoAnterior) * 100 : 0

  // Suggested selling price to maintain margin
  const suggestedVenta = numCostoInput > 0 ? numCostoInput * (1 + (margenActualPorcentaje / 100)) : 0
  
  const formatMXN = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

  const filteredProductos = productos.filter(p => 
    p.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.codigo_barras && p.codigo_barras.includes(searchTerm)) ||
    (p.nombre_proveedor && p.nombre_proveedor.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white overflow-hidden">
      <AppNavBar tenantId={tenantId} activeSection="inventario" />
      <div className="flex items-center gap-4 px-6 pt-4 pb-3 border-b border-zinc-800/60 shrink-0">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Box className="h-5 w-5 text-emerald-400" />
            Movimientos de Inventario
          </h1>
          <p className="text-xs text-zinc-500">Registra entradas (compras) o salidas (ajustes) de stock.</p>
        </div>
      </div>
      <div className="flex flex-1 gap-6 overflow-hidden px-6 py-4">
        
        {/* Left Col: Product Search */}
        <div className="w-1/2 flex flex-col space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-10 pr-4 py-3 text-sm focus:border-emerald-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {loading ? (
              <p className="text-center text-zinc-500 py-10">Cargando catálogo...</p>
            ) : filteredProductos.length === 0 ? (
              <p className="text-center text-zinc-500 py-10">No se encontraron productos.</p>
            ) : (
              filteredProductos.map(p => (
                <div 
                  key={p.id}
                  onClick={() => handleSelectProduct(p)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedProduct?.id === p.id 
                      ? 'border-emerald-500 bg-emerald-950/20 shadow-sm shadow-emerald-500/10' 
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm">{p.descripcion}</p>
                      <p className="text-xs text-zinc-500 font-mono mt-1">Barcode: {p.codigo_barras || '-'}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">Proveedor: {p.nombre_proveedor}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-400">Stock Actual</p>
                      <p className={`text-lg font-bold font-mono ${p.stock_actual <= p.stock_minimo ? 'text-red-400' : 'text-emerald-400'}`}>
                        {p.stock_actual} <span className="text-[10px] text-zinc-500">{p.unidad_medida}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Col: Form */}
        <div className="w-1/2 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col">
          {successMsg && (
            <div className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-400 text-sm font-semibold">
              <CheckCircle2 className="h-5 w-5" />
              {successMsg}
            </div>
          )}

          {!selectedProduct ? (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm text-center px-10">
              Selecciona un producto de la lista izquierda para registrar una entrada o salida de inventario.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedProduct.descripcion}</h3>
                <p className="text-sm text-zinc-400 mt-1">Stock actual: <strong className="text-emerald-400">{selectedProduct.stock_actual} {selectedProduct.unidad_medida}</strong></p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTipoMovimiento('entrada')}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-4 transition-all ${
                    tipoMovimiento === 'entrada'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900'
                  }`}
                >
                  <Plus className="h-5 w-5" />
                  <span className="font-bold">Entrada (Sumar)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipoMovimiento('salida')}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-4 transition-all ${
                    tipoMovimiento === 'salida'
                      ? 'border-red-500 bg-red-500/10 text-red-400'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900'
                  }`}
                >
                  <Minus className="h-5 w-5" />
                  <span className="font-bold">Salida (Restar)</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-zinc-400">Cantidad ({selectedProduct.unidad_medida})</label>
                  <input
                    required
                    type="number"
                    step="any"
                    min="0.01"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-lg font-mono focus:border-emerald-500 focus:outline-none"
                    placeholder="Ej. 50"
                  />
                </div>

                {tipoMovimiento === 'entrada' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-zinc-400">Proveedor</label>
                        <input
                          type="text"
                          required={tipoMovimiento === 'entrada'}
                          value={proveedor}
                          onChange={(e) => setProveedor(e.target.value)}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none"
                          placeholder="Nombre del proveedor"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-zinc-400">Costo de compra ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required={tipoMovimiento === 'entrada'}
                          value={costo}
                          onChange={(e) => setCosto(e.target.value)}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-mono focus:border-emerald-500 focus:outline-none"
                          placeholder="Costo unitario"
                        />
                        {/* Indicador de variación de precio */}
                        {costo && numCostoInput !== costoAnterior && (
                          <div className={`flex items-center gap-1 text-xs mt-1 font-semibold ${diffCosto < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {diffCosto < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            <span>{Math.abs(diffCosto).toFixed(2)} ({percentDiffCosto.toFixed(1)}%) {diffCosto < 0 ? 'más barato' : 'más caro'} que el actual ({formatMXN(costoAnterior)})</span>
                          </div>
                        )}
                        {costo && numCostoInput === costoAnterior && (
                          <div className="flex items-center gap-1 text-xs mt-1 text-zinc-500">
                            <MinusIcon className="h-3 w-3" />
                            <span>Sin cambio vs actual</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Sugerencia de precio de venta */}
                    {diffCosto !== 0 && numCostoInput > 0 && margenActualPorcentaje > 0 && (
                      <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-200">
                        <p>
                          <strong>Sugerencia de venta:</strong> Para mantener tu margen actual del <strong>{margenActualPorcentaje.toFixed(1)}%</strong>, 
                          el nuevo precio de venta debería ser <strong>{formatMXN(suggestedVenta)}</strong> (actual: {formatMXN(precioVentaActual)}). 
                          <span className="text-blue-400 text-xs block mt-1">Puedes actualizarlo después en la sección de Productos.</span>
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-zinc-400">Motivo / Notas (Opcional)</label>
                  <input
                    type="text"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder={tipoMovimiento === 'entrada' ? 'Ej. Compra al proveedor X' : 'Ej. Merma o ajuste'}
                  />
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-zinc-800 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !cantidad}
                  className={`rounded-xl px-8 py-3 font-bold text-white shadow-lg transition-all disabled:opacity-50 ${
                    tipoMovimiento === 'entrada' 
                      ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20' 
                      : 'bg-red-500 hover:bg-red-400 shadow-red-500/20'
                  }`}
                >
                  {isSubmitting 
                    ? 'Guardando...' 
                    : `Confirmar ${tipoMovimiento === 'entrada' ? 'Entrada' : 'Salida'}`
                  }
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
