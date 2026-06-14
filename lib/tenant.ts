// =============================================================
//  lib/tenant.ts
//  Resolves a tenant slug OR UUID to the real tenant UUID.
//  Used by all API routes that receive [tenantId] from the URL.
// =============================================================

import { createServerClient } from '@/lib/supabase/server-client'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Given either a slug (e.g. "blacklioncorp") or a raw UUID,
 * returns the real tenant UUID.  Returns null if not found.
 *
 * - If the input already looks like a UUID it is returned as-is
 *   (no extra round-trip needed).
 * - Otherwise we look it up by the `slug` column in `tenants`.
 */
export async function resolveTenantId(slugOrId: string): Promise<string | null> {
  if (UUID_RE.test(slugOrId)) return slugOrId

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slugOrId)
    .single()

  if (error || !data) return null
  return data.id
}
