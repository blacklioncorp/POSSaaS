import { LoginClient } from './LoginClient'
import { resolveTenantId } from '@/lib/tenant'

interface Props {
  params: Promise<{
    tenantId: string
  }>
}

export default async function LoginPage({ params }: Props) {
  const { tenantId: slugOrId } = await params
  const tenantId = await resolveTenantId(slugOrId) || slugOrId
  
  return <LoginClient tenantId={tenantId} />
}
