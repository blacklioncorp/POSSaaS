import { Suspense } from 'react'
import { HistorialPreciosClient } from './HistorialPreciosClient'

interface Props {
  params: Promise<{
    tenantId: string
  }>
}

export default async function HistorialPreciosPage({ params }: Props) {
  const { tenantId } = await params
  
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-500">
        Cargando historial...
      </div>
    }>
      <HistorialPreciosClient tenantId={tenantId} />
    </Suspense>
  )
}
