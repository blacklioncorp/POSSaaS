// =============================================================
//  app/(tenant)/[tenantId]/admin/productos/importar/page.tsx
//  Server Component wrapper for CSV import page
// =============================================================
import { CSVImportClient } from './CSVImportClient'

interface ImportPageProps {
  params: Promise<{ tenantId: string }>
}

export default async function ImportPage({ params }: ImportPageProps) {
  const { tenantId } = await params

  return <CSVImportClient tenantId={tenantId} />
}
