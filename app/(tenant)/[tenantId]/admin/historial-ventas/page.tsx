import { HistorialVentasClient } from './HistorialVentasClient'
import { resolveTenantId } from '@/lib/tenant'

interface Props {
  params: Promise<{
    tenantId: string
  }>
}

export default async function HistorialVentasPage({ params }: Props) {
  const { tenantId: slugOrId } = await params
  const tenantId = await resolveTenantId(slugOrId) || slugOrId
  
  return <HistorialVentasClient tenantId={tenantId} />
}
