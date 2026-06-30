-- =============================================================
--  POS SaaS Multi-tenant — Funciones para gestión de Usuarios
--  Archivo: supabase/migrations/20240611000002_manage_users.sql
-- =============================================================

-- ============================================================
--  FUNCIÓN: crear_usuario_pos
--  Inserta un nuevo usuario encriptando su PIN
-- ============================================================
CREATE OR REPLACE FUNCTION crear_usuario_pos(
    p_tenant_id UUID,
    p_nombre TEXT,
    p_rol VARCHAR,
    p_pin TEXT,
    p_activo BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usuario_id UUID;
BEGIN
    INSERT INTO usuarios (tenant_id, nombre, rol, activo, pin_hash)
    VALUES (
        p_tenant_id,
        p_nombre,
        p_rol,
        p_activo,
        extensions.crypt(p_pin, extensions.gen_salt('bf'))
    )
    RETURNING id INTO v_usuario_id;
    
    RETURN v_usuario_id;
END;
$$;


-- ============================================================
--  FUNCIÓN: actualizar_usuario_pos
--  Actualiza un usuario. Si p_pin no es nulo/vacío, lo encripta
--  y reemplaza el pin anterior.
-- ============================================================
CREATE OR REPLACE FUNCTION actualizar_usuario_pos(
    p_usuario_id UUID,
    p_tenant_id UUID,
    p_nombre TEXT,
    p_rol VARCHAR,
    p_pin TEXT,
    p_activo BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF COALESCE(p_pin, '') <> '' THEN
        -- Actualizar todo incluyendo el nuevo PIN
        UPDATE usuarios
           SET nombre = p_nombre,
               rol = p_rol,
               activo = p_activo,
               pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
         WHERE id = p_usuario_id
           AND tenant_id = p_tenant_id;
    ELSE
        -- Actualizar sin cambiar el PIN existente
        UPDATE usuarios
           SET nombre = p_nombre,
               rol = p_rol,
               activo = p_activo
         WHERE id = p_usuario_id
           AND tenant_id = p_tenant_id;
    END IF;
    
    RETURN TRUE;
END;
$$;
