-- =============================================================
--  Migration: add slug column to tenants
--  Allows URL-friendly identifiers like /blacklioncorp/dashboard
-- =============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Backfill existing rows: derive slug from nombre_comercio
-- (lowercase, spaces → hyphens, remove special chars)
UPDATE tenants
  SET slug = regexp_replace(
    lower(nombre_comercio),
    '[^a-z0-9]+', '', 'g'
  )
WHERE slug IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE tenants
  ALTER COLUMN slug SET NOT NULL;

-- Index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
