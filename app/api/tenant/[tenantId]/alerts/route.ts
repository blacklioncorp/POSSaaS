import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server-client'
import { resolveTenantId } from '@/lib/tenant'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId: slugOrId } = await params
  const supabase = createServerClient()

  try {
    const tenantId = await resolveTenantId(slugOrId)
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('productos_bajo_stock')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('nivel_alerta', { ascending: true })

    if (error) throw error

    return NextResponse.json({ alerts: data ?? [] })
  } catch (err: any) {
    console.error('Error in alerts API route:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
