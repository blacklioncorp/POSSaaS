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

    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('activo', true)
      .order('nombre', { ascending: true })

    if (error) throw error

    return NextResponse.json({ clientes: clientes ?? [] })
  } catch (err: any) {
    console.error('Error in clientes API route:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
