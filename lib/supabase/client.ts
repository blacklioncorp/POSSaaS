import { createBrowserClient } from '@supabase/ssr'

export function createClient(tenantId?: string) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: tenantId ? { 'x-tenant-id': tenantId } : {}
      }
    }
  )
}
