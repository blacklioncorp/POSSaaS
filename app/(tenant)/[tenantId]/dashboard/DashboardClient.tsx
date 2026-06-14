// =============================================================
//  app/(tenant)/[tenantId]/dashboard/DashboardClient.tsx
//  Dashboard en tiempo real conectado a Supabase.
//  Muestra ventas del día, transacciones, ticket promedio,
//  gráfica de ventas por hora y widget de bajo stock.
// =============================================================
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LowStockWidget } from '@/components/pos/LowStockWidget'
import { AppNavBar } from '@/components/pos/AppNavBar'
import { DollarSign, ShoppingCart, TrendingUp, Users, RefreshCw, Package } from 'lucide-react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface DashboardClientProps {
  tenantId: string
}

interface DayStats {
  totalVentas: number
  transacciones: number
  ticketPromedio: number
  nuevosClientes: number
}

interface HourData {
  time: string
  sales: number
}

interface TopProducto {
  descripcion: string
  cantidad_vendida: number
  total_vendido: number
}

export function DashboardClient({ tenantId }: DashboardClientProps) {
  const supabase = createClient(tenantId)
  const [stats, setStats] = useState<DayStats>({
    totalVentas: 0,
    transacciones: 0,
    ticketPromedio: 0,
    nuevosClientes: 0,
  })
  const [hourlyData, setHourlyData] = useState<HourData[]>([])
  const [topProductos, setTopProductos] = useState<TopProducto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const hoy = new Date()
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString()
  const finHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1).toISOString()

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true)
    try {
      const url = `/api/tenant/${tenantId}/dashboard?inicio=${encodeURIComponent(inicioHoy)}&fin=${encodeURIComponent(finHoy)}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
        setHourlyData(data.hourlyData)
        setTopProductos(data.topProductos)
      } else {
        console.error('Failed to fetch dashboard stats')
      }
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Error cargando dashboard:', err)
    } finally {
      setIsLoading(false)
    }
  }, [tenantId, inicioHoy, finHoy])

  useEffect(() => {
    fetchDashboardData()

    // Suscripción realtime para nuevas ventas
    const channel = supabase
      .channel(`dashboard-ventas-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ventas',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          // Refrescar al recibir una nueva venta
          fetchDashboardData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, tenantId, fetchDashboardData])

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white overflow-hidden">
      <AppNavBar tenantId={tenantId} activeSection="dashboard" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-zinc-500">
            Resumen del día en tiempo real
            {lastRefresh && (
              <span className="ml-2 text-zinc-600">
                · Actualizado {lastRefresh.toLocaleTimeString('es-MX')}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ventas del Día"
          value={fmt(stats.totalVentas)}
          icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
          loading={isLoading}
        />
        <StatCard
          title="Transacciones"
          value={String(stats.transacciones)}
          icon={<ShoppingCart className="h-5 w-5 text-blue-500" />}
          loading={isLoading}
        />
        <StatCard
          title="Ticket Promedio"
          value={fmt(stats.ticketPromedio)}
          icon={<TrendingUp className="h-5 w-5 text-purple-500" />}
          loading={isLoading}
        />
        <StatCard
          title="Nuevos Clientes"
          value={String(stats.nuevosClientes)}
          icon={<Users className="h-5 w-5 text-amber-500" />}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-white">Ventas por Hora</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {hoy.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="h-80 w-full">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-zinc-600">Cargando gráfica...</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    stroke="#52525b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#52525b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      borderColor: '#27272a',
                      color: '#fff',
                    }}
                    itemStyle={{ color: '#10b981' }}
                    formatter={(value: any) => [fmt(Number(value) || 0), 'Ventas']}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSales)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Low Stock Widget */}
        <div className="lg:col-span-1">
          <LowStockWidget tenantId={tenantId} />
        </div>
      </div>

      {/* Top productos del día */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-zinc-400" />
          <h3 className="text-sm font-semibold text-white">Top Productos del Día</h3>
        </div>
        {topProductos.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center py-6">
            Aún no hay ventas registradas hoy
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 uppercase tracking-wide border-b border-zinc-800">
                  <th className="text-left py-2 px-3 font-medium">Producto</th>
                  <th className="text-right py-2 px-3 font-medium">Cantidad</th>
                  <th className="text-right py-2 px-3 font-medium">Total Vendido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {topProductos.map((p, i) => (
                  <tr key={i} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-600 w-5">{i + 1}.</span>
                        <span className="text-white font-medium">{p.descripcion}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-400 tabular-nums">
                      {p.cantidad_vendida}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-400 tabular-nums">
                      {fmt(p.total_vendido)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

// ── Stat Card ────────────────────────────────────────────────
function StatCard({
  title,
  value,
  icon,
  loading,
}: {
  title: string
  value: string
  icon: React.ReactNode
  loading?: boolean
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-400">{title}</p>
        <div className="rounded-lg bg-zinc-800/50 p-2">{icon}</div>
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded bg-zinc-800" />
        ) : (
          <p className="text-2xl font-bold text-white">{value}</p>
        )}
      </div>
    </div>
  )
}
