import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server-client'
import { createSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const { tenantId, pin } = await request.json()
    if (!tenantId || !pin) {
      return NextResponse.json({ error: 'Faltan credenciales' }, { status: 400 })
    }

    const supabase = createServerClient()
    
    // Verificar PIN usando el RPC seguro
    const { data, error } = await supabase.rpc('verificar_pin_pos', {
      p_tenant_id: tenantId,
      p_pin: pin
    })

    if (error || !data || data.length === 0) {
      return NextResponse.json({ error: 'PIN incorrecto o usuario inactivo' }, { status: 401 })
    }

    const usuario = data[0]

    // Crear sesión (JWT Cookie)
    await createSession({
      userId: usuario.id,
      tenantId,
      nombre: usuario.nombre,
      rol: usuario.rol
    })

    return NextResponse.json({ success: true, user: usuario })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
