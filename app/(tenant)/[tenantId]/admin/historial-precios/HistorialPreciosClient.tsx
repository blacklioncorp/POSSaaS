'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TrendingDown, TrendingUp, Search, Calendar, ChevronLeft, ChevronRight, BarChart3, Package, ArrowDown, ArrowUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AppNavBar } from '@/components/pos/AppNavBar'
import type { HistorialPrecio, Producto } from '@/types/pos.types'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface Props { tenantId: string }

export function HistorialPreciosClient({ tenantId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProductId = searchParams.get('producto')

  const supabase = createClient(tenantId)

  const [historial, setHistorial] = useState<HistorialPrecio[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<string>(initialProductId || 'all')
  const [selectedProvider, setSelectedProvider] = useState<string>('all')

  // Pagination
  const [page, setPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      
      const [histRes, prodRes] = await Promise.all([
        supabase.from('historial_precios').select('*, productos(descripcion)').eq('tenant_id', tenantId).order('creado_en', { ascending: false }),
        supabase.from('productos').select('*').eq('tenant_id', tenantId)
      ])

      if (histRes.data) {
        // Map the joined data
        const mappedHistorial = histRes.data.map(h => ({
          ...h,
          descripcion_producto: h.productos?.descripcion || 'Producto desconocido'
        })) as HistorialPrecio[]
        setHistorial(mappedHistorial)
      }
      
      if (prodRes.data) {
        setProductos(prodRes.data as Producto[])
      }

      setLoading(false)
    }
    loadData()
  }, [tenantId, supabase])

  // Extract unique providers
  const providers = useMemo(() => {
    const provs = new Set(historial.map(h => h.nombre_proveedor))
    return Array.from(provs).sort()
  }, [historial])

  // Filtered data
  const filteredData = useMemo(() => {
    return historial.filter(h => {
      const matchProduct = selectedProduct === 'all' || h.producto_id === selectedProduct
      const matchProvider = selectedProvider === 'all' || h.nombre_proveedor === selectedProvider
      const matchSearch = searchTerm === '' || h.descripcion_producto?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchProduct && matchProvider && matchSearch
    })
  }, [historial, selectedProduct, selectedProvider, searchTerm])

  // KPIs
  const kpis = useMemo(() => {
    if (filteredData.length === 0) return null

    const totalRegistros = filteredData.length
    
    // Average price
    const totalCost = filteredData.reduce((sum, h) => sum + (h.precio_compra * h.cantidad), 0)
    const totalQty = filteredData.reduce((sum, h) => sum + h.cantidad, 0)
    const avgPrice = totalQty > 0 ? totalCost / totalQty : 0

    // Best provider (only if a specific product is selected)
    let bestProvider = 'N/A'
    if (selectedProduct !== 'all') {
      const provStats = filteredData.reduce((acc, h) => {
        if (!acc[h.nombre_proveedor]) acc[h.nombre_proveedor] = { sum: 0, qty: 0 }
        acc[h.nombre_proveedor].sum += (h.precio_compra * h.cantidad)
        acc[h.nombre_proveedor].qty += h.cantidad
        return acc
      }, {} as Record<string, { sum: number, qty: number }>)
      
      let minAvg = Infinity
      for (const [prov, stats] of Object.entries(provStats)) {
        const avg = stats.sum / stats.qty
        if (avg < minAvg) {
          minAvg = avg
          bestProvider = prov
        }
      }
    }

    // Max increase
    let maxIncrease = { pct: 0, prod: 'N/A' }
    filteredData.forEach(h => {
      if (h.precio_anterior && h.precio_anterior > 0) {
        const diff = h.precio_compra - h.precio_anterior
        if (diff > 0) {
          const pct = (diff / h.precio_anterior) * 100
          if (pct > maxIncrease.pct) {
            maxIncrease = { pct, prod: h.descripcion_producto || 'N/A' }
          }
        }
      }
    })

    return { totalRegistros, avgPrice, bestProvider, maxIncrease }
  }, [filteredData, selectedProduct])

  // Chart Data (Only if a specific product is selected)
  const chartData = useMemo(() => {
    if (selectedProduct === 'all' || filteredData.length === 0) return null

    // Group by provider for datasets
    const provs = Array.from(new Set(filteredData.map(h => h.nombre_proveedor)))
    
    // Sort chronological for chart
    const chronologicalData = [...filteredData].sort((a, b) => new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime())
    const labels = chronologicalData.map(h => new Date(h.creado_en).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }))

    const colors = [
      'rgb(52, 211, 153)', // emerald
      'rgb(96, 165, 250)', // blue
      'rgb(244, 114, 182)', // pink
      'rgb(251, 191, 36)', // amber
      'rgb(167, 139, 250)', // purple
    ]

    const datasets = provs.map((prov, i) => {
      const dataPoints = chronologicalData.map(h => h.nombre_proveedor === prov ? h.precio_compra : null)
      return {
        label: prov,
        data: dataPoints,
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length],
        tension: 0.3,
        spanGaps: true,
        pointRadius: 4,
        pointHoverRadius: 6,
      }
    })

    return { labels, datasets }
  }, [filteredData, selectedProduct])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { color: 'rgb(161, 161, 170)' } // zinc-400
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        ticks: {
          color: 'rgb(161, 161, 170)',
          callback: function(value: any) {
            return '$' + value;
          }
        },
        grid: { color: 'rgba(63, 63, 70, 0.5)' } // zinc-700
      },
      x: {
        ticks: { color: 'rgb(161, 161, 170)' },
        grid: { color: 'rgba(63, 63, 70, 0.5)' }
      }
    }
  }

  // Provider Comparison Table (Only if specific product selected)
  const providerComparison = useMemo(() => {
    if (selectedProduct === 'all' || filteredData.length === 0) return []

    const stats = filteredData.reduce((acc, h) => {
      if (!acc[h.nombre_proveedor]) {
        acc[h.nombre_proveedor] = {
          prov: h.nombre_proveedor,
          lastPrice: h.precio_compra,
          lastDate: new Date(h.creado_en),
          min: h.precio_compra,
          max: h.precio_compra,
          sum: 0,
          qty: 0,
          count: 0
        }
      } else {
        const d = acc[h.nombre_proveedor]
        const currDate = new Date(h.creado_en)
        if (currDate > d.lastDate) {
          d.lastDate = currDate
          d.lastPrice = h.precio_compra
        }
        if (h.precio_compra < d.min) d.min = h.precio_compra
        if (h.precio_compra > d.max) d.max = h.precio_compra
      }
      
      acc[h.nombre_proveedor].sum += (h.precio_compra * h.cantidad)
      acc[h.nombre_proveedor].qty += h.cantidad
      acc[h.nombre_proveedor].count += 1
      
      return acc
    }, {} as Record<string, any>)

    const result = Object.values(stats).map(s => ({
      ...s,
      avg: s.qty > 0 ? s.sum / s.qty : 0
    }))
    
    // find best avg to highlight
    if (result.length > 0) {
      const best = result.reduce((min, curr) => curr.avg < min.avg ? curr : min, result[0])
      result.forEach(r => { r.isBest = r.prov === best.prov })
    }

    return result
  }, [filteredData, selectedProduct])

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  const formatMXN = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
  
  if (loading) {
    return (
      <div className="flex h-screen flex-col bg-zinc-950 text-white">
        <AppNavBar tenantId={tenantId} activeSection="historial-precios" />
        <div className="flex flex-1 items-center justify-center text-zinc-500">Cargando historial...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white overflow-hidden">
      <AppNavBar tenantId={tenantId} activeSection="historial-precios" />

      {/* Header & Filters */}
      <div className="flex flex-col gap-4 px-6 pt-5 pb-4 border-b border-zinc-800/60 shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-emerald-400" />
              Historial de Precios
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">Analiza costos de compra y variaciones por proveedor.</p>
          </div>
        </div>

        <div className="flex gap-4 items-center bg-zinc-900/40 p-3 rounded-xl border border-zinc-800">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-4 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          
          <div className="w-1/3">
            <select 
              value={selectedProduct}
              onChange={(e) => { setSelectedProduct(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">Todos los productos</option>
              {productos.map(p => (
                <option key={p.id} value={p.id}>{p.descripcion}</option>
              ))}
            </select>
          </div>

          <div className="w-1/4">
            <select 
              value={selectedProvider}
              onChange={(e) => { setSelectedProvider(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">Todos los proveedores</option>
              {providers.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs font-bold text-zinc-400 uppercase">Registros Totales</p>
              <p className="text-2xl font-bold mt-1 text-white">{kpis.totalRegistros}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs font-bold text-zinc-400 uppercase">Precio Promedio</p>
              <p className="text-2xl font-bold mt-1 text-emerald-400 font-mono">{formatMXN(kpis.avgPrice)}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs font-bold text-zinc-400 uppercase">Mejor Proveedor</p>
              <p className="text-lg font-bold mt-1 text-amber-400 truncate" title={kpis.bestProvider}>
                {selectedProduct === 'all' ? 'Selecciona un producto' : kpis.bestProvider}
              </p>
            </div>
            <div className="rounded-xl border border-red-900/20 bg-red-950/10 p-4">
              <p className="text-xs font-bold text-red-400/80 uppercase">Mayor Alza Reciente</p>
              <div className="flex items-end gap-2 mt-1">
                <span className="text-2xl font-bold text-red-400">+{kpis.maxIncrease.pct.toFixed(1)}%</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1 truncate" title={kpis.maxIncrease.prod}>{kpis.maxIncrease.prod}</p>
            </div>
          </div>
        )}

        {/* Analytics Section (Chart & Comparativo) */}
        {selectedProduct !== 'all' && chartData && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4 h-80">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-400" />
                Tendencia de Precios
              </h3>
              <div className="h-64 relative w-full">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>
            
            <div className="col-span-1 rounded-xl border border-zinc-800 bg-zinc-900 p-4 overflow-y-auto h-80">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-400" />
                Comparativo de Proveedores
              </h3>
              <div className="space-y-3">
                {providerComparison.map((p, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${p.isBest ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-zinc-800 bg-zinc-950'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-sm">{p.prov}</span>
                      {p.isBest && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold uppercase">Mejor Opción</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex flex-col"><span className="text-zinc-500">Promedio</span><span className="font-mono text-white">{formatMXN(p.avg)}</span></div>
                      <div className="flex flex-col"><span className="text-zinc-500">Último</span><span className="font-mono text-emerald-400">{formatMXN(p.lastPrice)}</span></div>
                      <div className="flex flex-col"><span className="text-zinc-500">Rango</span><span className="font-mono text-zinc-400">{formatMXN(p.min)} - {formatMXN(p.max)}</span></div>
                      <div className="flex flex-col"><span className="text-zinc-500">Compras</span><span className="text-zinc-300">{p.count}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="rounded-2xl border border-zinc-800 overflow-hidden bg-zinc-900">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900">
            <h3 className="text-sm font-bold text-white">Detalle de Movimientos</h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-950 border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3 text-right">Cantidad</th>
                <th className="px-4 py-3 text-right">Costo Unitario</th>
                <th className="px-4 py-3 text-right">Variación</th>
                <th className="px-4 py-3">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/50">
              {paginatedData.length > 0 ? paginatedData.map(h => {
                const diff = h.precio_anterior ? h.precio_compra - h.precio_anterior : 0;
                const pct = h.precio_anterior ? (Math.abs(diff) / h.precio_anterior) * 100 : 0;
                
                return (
                  <tr key={h.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                      {new Date(h.creado_en).toLocaleString('es-MX', { 
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' 
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium truncate max-w-[200px]" title={h.descripcion_producto}>
                      {h.descripcion_producto}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {h.nombre_proveedor}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-300">
                      {h.cantidad}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400">
                      {formatMXN(h.precio_compra)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {diff !== 0 ? (
                          <>
                            <span className={`text-[10px] rounded px-1.5 py-0.5 font-bold flex items-center gap-0.5 ${diff < 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                              {diff < 0 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                              {pct.toFixed(1)}%
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-500 font-mono">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 truncate max-w-[150px]" title={h.notas || ''}>
                      {h.notas || '-'}
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    No hay registros que coincidan con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 bg-zinc-950">
              <p className="text-xs text-zinc-500">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
