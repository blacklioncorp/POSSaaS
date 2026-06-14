import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server-client'
import { resolveTenantId } from '@/lib/tenant'

// GET active shift for a tenant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId: slugOrId } = await params
  const { searchParams } = new URL(request.url)
  const usuarioId = searchParams.get('usuarioId')

  if (!usuarioId) {
    return NextResponse.json({ error: 'Missing usuarioId query parameter' }, { status: 400 })
  }

  const supabase = createServerClient()

  try {
    const tenantId = await resolveTenantId(slugOrId)
    if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { data: shift, error } = await supabase
      .from('caja_turnos')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('usuario_id', usuarioId)
      .eq('estado', 'abierto')
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ shift })
  } catch (err: any) {
    console.error('Error fetching shift:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST open a new shift
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId: slugOrId } = await params
  const supabase = createServerClient()

  try {
    const tenantId = await resolveTenantId(slugOrId)
    if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { usuarioId, montoApertura, notas } = await request.json()

    if (!usuarioId) {
      return NextResponse.json({ error: 'Missing usuarioId' }, { status: 400 })
    }

    // 1. Check if there is already an open shift
    const { data: existingShift } = await supabase
      .from('caja_turnos')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('usuario_id', usuarioId)
      .eq('estado', 'abierto')
      .maybeSingle()

    if (existingShift) {
      return NextResponse.json({ error: 'Ya existe un turno abierto para este usuario.' }, { status: 400 })
    }

    // 2. Open new shift
    const { data: newShift, error: insertError } = await supabase
      .from('caja_turnos')
      .insert({
        tenant_id: tenantId,
        usuario_id: usuarioId,
        monto_apertura: Number(montoApertura) || 0,
        estado: 'abierto',
        notas: notas || '',
      })
      .select('*')
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ shift: newShift })
  } catch (err: any) {
    console.error('Error opening shift:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT close shift
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId: slugOrId } = await params
  const supabase = createServerClient()

  try {
    const tenantId = await resolveTenantId(slugOrId)
    if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { shiftId, montoCierre, notas } = await request.json()

    if (!shiftId) {
      return NextResponse.json({ error: 'Missing shiftId' }, { status: 400 })
    }

    const { data: closedShift, error: updateError } = await supabase
      .from('caja_turnos')
      .update({
        estado: 'cerrado',
        monto_cierre: Number(montoCierre) || 0,
        fecha_cierre: new Date().toISOString(),
        notas: notas || '',
      })
      .eq('id', shiftId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ shift: closedShift })
  } catch (err: any) {
    console.error('Error closing shift:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
