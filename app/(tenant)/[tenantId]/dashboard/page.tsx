// =============================================================
//  app/(tenant)/[tenantId]/dashboard/page.tsx
//  Server Component wrapper — unwraps async params properly.
// =============================================================
import { DashboardClient } from './DashboardClient'

interface DashboardPageProps {
  params: Promise<{ tenantId: string }>
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { tenantId } = await params

  return <DashboardClient tenantId={tenantId} />
}
