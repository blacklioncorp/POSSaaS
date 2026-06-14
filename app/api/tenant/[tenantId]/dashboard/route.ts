import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server-client'
import { resolveTenantId } from '@/lib/tenant'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId: slugOrId } = await params
  const { searchParams } = new URL(request.url)
  const inicio = searchParams.get('inicio')
  const fin = searchParams.get('fin')

  if (!inicio || !fin) {
    return NextResponse.json({ error: 'Missing inicio or fin date parameters' }, { status: 400 })
  }

  const supabase = createServerClient()

  try {
    const tenantId = await resolveTenantId(slugOrId)
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // 1. Fetch sales
    const { data: ventas, error: ventasError } = await supabase
      .from('ventas')
      .select('id, total, creado_en')
      .eq('tenant_id', tenantId)
      .gte('creado_en', inicio)
      .lt('creado_en', fin)
      .order('creado_en', { ascending: true })

    if (ventasError) throw ventasError

    const ventasArr = ventas ?? []
    const totalVentas = ventasArr.reduce((s, v) => s + Number(v.total || 0), 0)
    const transacciones = ventasArr.length
    const ticketPromedio = transacciones > 0 ? totalVentas / transacciones : 0

    // 2. Fetch new clients
    const { count: nuevosClientes, error: clientesError } = await supabase
      .from('clientes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('creado_en', inicio)
      .lt('creado_en', fin)

    if (clientesError) throw clientesError

    // 3. Hourly data map
    const hourMap = new Map<string, number>()
    for (let h = 6; h <= 23; h++) {
      hourMap.set(`${String(h).padStart(2, '0')}:00`, 0)
    }
    ventasArr.forEach(v => {
      const hour = new Date(v.creado_en).getHours()
      const key = `${String(hour).padStart(2, '0')}:00`
      hourMap.set(key, (hourMap.get(key) || 0) + Number(v.total || 0))
    })
    const hourlyData = Array.from(hourMap.entries()).map(([time, sales]) => ({ time, sales }))

    // 4. Top products of the day
    const { data: detalles, error: detallesError } = await supabase
      .from('detalles_ventas')
      .select(`
        cantidad,
        subtotal,
        producto:productos(descripcion),
        venta:ventas!inner(tenant_id, creado_en)
      `)
      .eq('venta.tenant_id', tenantId)
      .gte('venta.creado_en', inicio)
      .lt('venta.creado_en', fin)

    if (detallesError) throw detallesError

    const prodMap = new Map<string, { cantidad: number; total: number }>()
    if (detalles && detalles.length > 0) {
      detalles.forEach((d: any) => {
        const desc = d.producto?.descripcion ?? 'Desconocido'
        const prev = prodMap.get(desc) || { cantidad: 0, total: 0 }
        prodMap.set(desc, {
          cantidad: prev.cantidad + Number(d.cantidad || 0),
          total: prev.total + Number(d.subtotal || 0),
        })
      })
    }

    const topProductos = Array.from(prodMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([desc, data]) => ({
        descripcion: desc,
        cantidad_vendida: data.cantidad,
        total_vendido: data.total,
      }))

    return NextResponse.json({
      stats: {
        totalVentas,
        transacciones,
        ticketPromedio,
        nuevosClientes: nuevosClientes ?? 0,
      },
      hourlyData,
      topProductos,
    })
  } catch (err: any) {
    console.error('Error in dashboard API route:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
