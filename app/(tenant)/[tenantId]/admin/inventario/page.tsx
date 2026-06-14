// =============================================================
//  app/(tenant)/[tenantId]/admin/inventario/page.tsx
// =============================================================
import { InventarioClient } from './InventarioClient'

interface InventarioPageProps {
  params: Promise<{ tenantId: string }>
}

export default async function InventarioPage({ params }: InventarioPageProps) {
  const { tenantId } = await params

  return <InventarioClient tenantId={tenantId} />
}
