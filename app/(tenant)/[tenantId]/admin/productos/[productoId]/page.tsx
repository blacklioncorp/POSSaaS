// =============================================================
//  app/(tenant)/[tenantId]/admin/productos/[productoId]/page.tsx
// =============================================================
import { EditarProductoClient } from './EditarProductoClient'

interface Props {
  params: Promise<{ tenantId: string; productoId: string }>
}

export default async function EditarProductoPage({ params }: Props) {
  const { tenantId, productoId } = await params
  return <EditarProductoClient tenantId={tenantId} productoId={productoId} />
}
