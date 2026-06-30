-- ============================================================
-- TABLA: historial_precios
-- Historial de cambios de precio de compra y proveedor.
-- ============================================================
CREATE TABLE IF NOT EXISTS historial_precios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    producto_id     UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    nombre_proveedor TEXT NOT NULL,
    precio_compra   NUMERIC(12, 4) NOT NULL,
    precio_anterior NUMERIC(12, 4),
    cantidad        NUMERIC(12, 4) NOT NULL,
    notas           TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_historial_tenant ON historial_precios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_historial_producto ON historial_precios(producto_id);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial_precios(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_historial_proveedor ON historial_precios(nombre_proveedor);

-- Habilitar RLS
ALTER TABLE historial_precios ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "historial_precios: solo su tenant"
    ON historial_precios
    USING (tenant_id = public.get_tenant_id());

CREATE POLICY "historial_precios: insertar en su tenant"
    ON historial_precios FOR INSERT
    WITH CHECK (tenant_id = public.get_tenant_id());

-- Publicación Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE historial_precios;

-- ============================================================
-- SCRIPT DE MIGRACIÓN: Poblar datos iniciales
-- Inserta un registro inicial en historial_precios para
-- todos los productos existentes, usando su precio_compra
-- y nombre_proveedor actual, para tener un punto de partida.
-- ============================================================
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT id, tenant_id, nombre_proveedor, precio_compra FROM productos LOOP
        -- Verificar si ya existe un registro inicial para este producto para evitar duplicados si se corre varias veces
        IF NOT EXISTS (SELECT 1 FROM historial_precios WHERE producto_id = rec.id) THEN
            INSERT INTO historial_precios (
                tenant_id,
                producto_id,
                nombre_proveedor,
                precio_compra,
                precio_anterior,
                cantidad,
                notas
            ) VALUES (
                rec.tenant_id,
                rec.id,
                COALESCE(rec.nombre_proveedor, 'Sin Proveedor'),
                rec.precio_compra,
                rec.precio_compra, -- Al ser el primero, anterior = actual
                1, -- Cantidad base referencial
                'Registro inicial'
            );
        END IF;
    END LOOP;
END;
$$;
