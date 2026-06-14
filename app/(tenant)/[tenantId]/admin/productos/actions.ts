'use server'

import { createServerClient } from '@/lib/supabase/server-client'

export async function getTenantProductos(tenantId: string) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('productos')
    .select('*, categorias(nombre_categoria)')
    .eq('tenant_id', tenantId)
    .eq('activo', true)
    .order('descripcion', { ascending: true })

  if (error) {
    console.error('Error fetching products:', error)
    return []
  }

  return (data || []).map((d: any) => ({
    ...d,
    categoria_nombre: d.categorias?.nombre_categoria || 'Sin Categoría'
  }))
}
