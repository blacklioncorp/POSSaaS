// =============================================================
//  app/(tenant)/[tenantId]/admin/productos/nuevo/page.tsx
// =============================================================
import { Suspense } from 'react'
import { NuevoProductoClient } from './NuevoProductoClient'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function NuevoProductoPage({ params }: Props) {
  const { tenantId } = await params
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-zinc-950 text-emerald-500">Cargando formulario...</div>}>
      <NuevoProductoClient tenantId={tenantId} />
    </Suspense>
  )
}
