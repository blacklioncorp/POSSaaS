// =============================================================
//  app/(tenant)/[tenantId]/admin/productos/page.tsx
//  Server Component wrapper — unwraps async params properly.
// =============================================================
import { ProductosClient } from './ProductosClient'

interface ProductosPageProps {
  params: Promise<{ tenantId: string }>
}

export default async function ProductosPage({ params }: ProductosPageProps) {
  const { tenantId } = await params

  return <ProductosClient tenantId={tenantId} />
}
