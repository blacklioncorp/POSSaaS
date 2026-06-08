'use client'

import { LowStockWidget } from '@/components/pos/LowStockWidget'
import { DollarSign, ShoppingCart, TrendingUp, Users } from 'lucide-react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface DashboardProps {
  params: { tenantId: string }
}

const mockSalesData = [
  { time: '08:00', sales: 0 },
  { time: '09:00', sales: 1200 },
  { time: '10:00', sales: 3400 },
  { time: '11:00', sales: 2800 },
  { time: '12:00', sales: 5600 },
  { time: '13:00', sales: 8900 },
  { time: '14:00', sales: 7200 },
  { time: '15:00', sales: 4100 },
  { time: '16:00', sales: 3800 },
  { time: '17:00', sales: 5900 },
  { time: '18:00', sales: 9100 },
  { time: '19:00', sales: 8400 },
  { time: '20:00', sales: 4200 },
]

export default function DashboardPage({ params }: DashboardProps) {
  const { tenantId } = params

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white overflow-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-zinc-500">Resumen del día en tiempo real</p>
        </div>
        <div className="flex gap-3">
          <button className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 transition-colors">
            Descargar Reporte
          </button>
          <a
            href={`/${tenantId}/ventas`}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-400 transition-colors"
          >
            Abrir POS
          </a>
        </div>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ventas del Día"
          value="$64,600.00"
          trend="+14% vs ayer"
          trendUp={true}
          icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
        />
        <StatCard
          title="Transacciones"
          value="142"
          trend="+5% vs ayer"
          trendUp={true}
          icon={<ShoppingCart className="h-5 w-5 text-blue-500" />}
        />
        <StatCard
          title="Ticket Promedio"
          value="$454.92"
          trend="-2% vs ayer"
          trendUp={false}
          icon={<TrendingUp className="h-5 w-5 text-purple-500" />}
        />
        <StatCard
          title="Nuevos Clientes"
          value="12"
          trend="+1 vs ayer"
          trendUp={true}
          icon={<Users className="h-5 w-5 text-amber-500" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-white">Ventas por Hora</h3>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockSalesData}>
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
          </div>
        </div>

        {/* Low Stock Widget */}
        <div className="lg:col-span-1">
          <LowStockWidget tenantId={tenantId} />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  trend,
  trendUp,
  icon,
}: {
  title: string
  value: string
  trend: string
  trendUp: boolean
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-400">{title}</p>
        <div className="rounded-lg bg-zinc-800/50 p-2">{icon}</div>
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-white">{value}</p>
        <p
          className={`mt-1 text-xs font-medium ${
            trendUp ? 'text-emerald-500' : 'text-red-500'
          }`}
        >
          {trend}
        </p>
      </div>
    </div>
  )
}
