-- =============================================================
--  POS SaaS Multi-tenant — Funciones para Autenticación
--  Archivo: supabase/migrations/20240611000003_auth_login.sql
-- =============================================================

-- ============================================================
--  FUNCIÓN: verificar_pin_pos
--  Comprueba si el PIN ingresado coincide con el hash guardado.
-- ============================================================
CREATE OR REPLACE FUNCTION verificar_pin_pos(
    p_tenant_id UUID,
    p_pin TEXT
)
RETURNS TABLE (
    id UUID,
    nombre TEXT,
    rol VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.nombre, u.rol
      FROM usuarios u
     WHERE u.tenant_id = p_tenant_id
       AND u.activo = TRUE
       -- extensions.crypt(pin_ingresado, hash_guardado) devuelve el mismo hash si coinciden
       AND u.pin_hash = extensions.crypt(p_pin, u.pin_hash)
     LIMIT 1;
END;
$$;
