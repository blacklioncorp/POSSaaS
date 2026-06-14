-- ============================================================
-- TABLA: movimientos_inventario
-- Historial de entradas y salidas de mercancía (Kardex)
-- ============================================================
CREATE TABLE movimientos_inventario (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    producto_id     UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    tipo            VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
    cantidad        NUMERIC(12, 4) NOT NULL,
    stock_anterior  NUMERIC(12, 4) NOT NULL,
    stock_nuevo     NUMERIC(12, 4) NOT NULL,
    motivo          TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_movimientos_tenant ON movimientos_inventario(tenant_id);
CREATE INDEX idx_movimientos_producto ON movimientos_inventario(producto_id);

ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movimientos: solo su tenant"
    ON movimientos_inventario
    USING (tenant_id = public.get_tenant_id());

CREATE POLICY "movimientos: insertar en su tenant"
    ON movimientos_inventario FOR INSERT
    WITH CHECK (tenant_id = public.get_tenant_id());
