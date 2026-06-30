import { UsuariosClient } from './UsuariosClient'

interface Props {
  params: Promise<{
    tenantId: string
  }>
}

export default async function UsuariosPage({ params }: Props) {
  const { tenantId } = await params
  
  return <UsuariosClient tenantId={tenantId} />
}
