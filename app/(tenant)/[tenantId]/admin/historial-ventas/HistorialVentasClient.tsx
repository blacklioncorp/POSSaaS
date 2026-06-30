'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  History, Download, Filter, Loader2, Receipt, Calendar, 
  ChevronDown, ChevronRight, AlertCircle, BarChart3, Clock, CalendarDays, User
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AppNavBar } from '@/components/pos/AppNavBar'

interface VentasClientProps {
  tenantId: string
}

type RangoFiltro = 'hora' | 'dia' | 'semana' | 'mes'

export function HistorialVentasClient({ tenantId }: VentasClientProps) {
  const supabase = createClient(tenantId)
  
  const [ventas, setVentas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [rango, setRango] = useState<RangoFiltro>('dia')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchVentas()
  }, [rango])

  const fetchVentas = async () => {
    setLoading(true)
    
    // Calcular fecha inicial según rango
    const ahora = new Date()
    let fechaInicio = new Date()
    
    switch (rango) {
      case 'hora':
        fechaInicio.setHours(ahora.getHours() - 1)
        break
      case 'dia':
        fechaInicio.setHours(0, 0, 0, 0)
        break
      case 'semana':
        fechaInicio.setDate(ahora.getDate() - 7)
        fechaInicio.setHours(0, 0, 0, 0)
        break
      case 'mes':
        fechaInicio.setMonth(ahora.getMonth() - 1)
        fechaInicio.setHours(0, 0, 0, 0)
        break
    }

    const isoFecha = fechaInicio.toISOString()

    const { data, error } = await supabase
      .from('ventas')
      .select(`
        id, folio, total, subtotal, metodo_pago, creado_en, 
        usuarios(nombre, rol),
        detalles_ventas(
          cantidad, subtotal, precio_aplicado,
          productos(descripcion)
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('estado', 'completada')
      .gte('creado_en', isoFecha)
      .order('creado_en', { ascending: false })
      
    if (!error && data) {
      setVentas(data)
    }
    setLoading(false)
  }

  const kpis = useMemo(() => {
    let totalVendido = 0
    let totalTickets = ventas.length
    const ventasPorUsuario: Record<string, number> = {}

    ventas.forEach(v => {
      totalVendido += Number(v.total)
      const uName = v.usuarios?.nombre || 'Desconocido'
      ventasPorUsuario[uName] = (ventasPorUsuario[uName] || 0) + Number(v.total)
    })

    const topUsuario = Object.entries(ventasPorUsuario).sort((a, b) => b[1] - a[1])[0]

    // Ventas por hora para la gráfica/indicador
    const ticketPromedio = totalTickets > 0 ? totalVendido / totalTickets : 0

    return { totalVendido, totalTickets, ticketPromedio, topUsuario }
  }, [ventas])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
  }

  const exportToCsv = () => {
    let csv = 'Folio,Fecha,Hora,Cajero,Total,Metodo de Pago\n'
    
    ventas.forEach(v => {
      const d = new Date(v.creado_en)
      const fecha = d.toLocaleDateString('es-MX')
      const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      const cajero = v.usuarios?.nombre || 'Desconocido'
      const total = v.total
      const metodo = v.metodo_pago

      csv += `"${v.folio}","${fecha}","${hora}","${cajero}","${total}","${metodo}"\n`
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `historial-ventas-${rango}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 flex flex-col">
      <AppNavBar tenantId={tenantId} activeSection="historial-ventas" />

      <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Header y Filtros */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <History className="w-7 h-7 text-emerald-500" />
              Historial de Ventas
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Registro auditable de ventas por perfil y horarios.
            </p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1">
              {(['hora', 'dia', 'semana', 'mes'] as RangoFiltro[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRango(r)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                    rango === r ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {r === 'hora' ? 'Última Hora' : `Este ${r}`}
                </button>
              ))}
            </div>

            <button
              onClick={exportToCsv}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm border border-zinc-700"
              title="Descargar historial en Excel (CSV)"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <BarChart3 className="w-12 h-12 text-emerald-500" />
            </div>
            <p className="text-zinc-500 text-sm font-medium mb-1">Total Vendido</p>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(kpis.totalVendido)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Receipt className="w-12 h-12 text-blue-500" />
            </div>
            <p className="text-zinc-500 text-sm font-medium mb-1">Tickets Totales</p>
            <p className="text-2xl font-bold text-white">{kpis.totalTickets}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <History className="w-12 h-12 text-purple-500" />
            </div>
            <p className="text-zinc-500 text-sm font-medium mb-1">Ticket Promedio</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(kpis.ticketPromedio)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <User className="w-12 h-12 text-amber-500" />
            </div>
            <p className="text-zinc-500 text-sm font-medium mb-1">Mejor Vendedor</p>
            <p className="text-xl font-bold text-white truncate pr-6">{kpis.topUsuario ? kpis.topUsuario[0] : '--'}</p>
            {kpis.topUsuario && <p className="text-xs text-amber-500 mt-1">{formatCurrency(kpis.topUsuario[1])}</p>}
          </div>
        </div>

        {/* Tabla Detallada */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950/50 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-medium w-10"></th>
                  <th className="px-6 py-4 font-medium">Folio / Fecha</th>
                  <th className="px-6 py-4 font-medium">Perfil Responsable</th>
                  <th className="px-6 py-4 font-medium">Método</th>
                  <th className="px-6 py-4 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                      Cargando historial...
                    </td>
                  </tr>
                ) : ventas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 flex flex-col items-center">
                      <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                      No hay ventas registradas en el rango seleccionado.
                    </td>
                  </tr>
                ) : (
                  ventas.map(v => {
                    const isExpanded = expandedId === v.id
                    return (
                      <React.Fragment key={v.id}>
                        <tr 
                          onClick={() => setExpandedId(isExpanded ? null : v.id)}
                          className={`hover:bg-zinc-800/50 cursor-pointer transition-colors ${isExpanded ? 'bg-zinc-800/30' : ''}`}
                        >
                          <td className="px-6 py-4 text-zinc-500">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                                #{String(v.folio).padStart(6, '0')}
                              </span>
                              <span className="text-zinc-500 text-xs flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(v.creado_en).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{v.usuarios?.nombre || 'Desconocido'}</span>
                              <span className="text-[10px] uppercase text-zinc-500 border border-zinc-700 px-1.5 rounded">{v.usuarios?.rol || ''}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 capitalize text-zinc-400">
                            {v.metodo_pago}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-white">
                            {formatCurrency(v.total)}
                          </td>
                        </tr>
                        
                        {/* Detalles Desplegables */}
                        {isExpanded && (
                          <tr className="bg-zinc-950/50">
                            <td colSpan={5} className="px-6 py-4 border-l-2 border-emerald-500">
                              <div className="pl-8">
                                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Productos en esta venta</h4>
                                <div className="space-y-2">
                                  {v.detalles_ventas?.map((d: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-sm bg-zinc-900 border border-zinc-800 p-2 rounded-lg">
                                      <div className="flex items-center gap-3">
                                        <span className="bg-zinc-800 text-zinc-300 font-mono text-xs px-2 py-1 rounded">
                                          {d.cantidad}x
                                        </span>
                                        <span className="text-white">{d.productos?.descripcion || 'Producto borrado'}</span>
                                      </div>
                                      <div className="text-zinc-400 tabular-nums">
                                        {formatCurrency(d.subtotal)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
