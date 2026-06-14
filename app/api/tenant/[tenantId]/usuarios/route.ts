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

    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('id, nombre, rol, activo')
      .eq('tenant_id', tenantId)
      .eq('activo', true)

    if (error) throw error

    return NextResponse.json({ usuarios: usuarios ?? [] })
  } catch (err: any) {
    console.error('Error in users API route:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
