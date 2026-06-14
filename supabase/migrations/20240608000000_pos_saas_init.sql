-- =============================================================
--  POS SaaS Multi-tenant — Script SQL Completo para Supabase
--  Archivo: supabase/migrations/001_pos_saas_init.sql
-- =============================================================

-- ------------------------------------------------------------
-- EXTENSIONES (pgcrypto ya existe en Supabase Cloud bajo schema extensions)
-- ------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- TABLA: tenants
-- Cada fila representa un comercio/negocio independiente.
-- ============================================================
CREATE TABLE tenants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_comercio TEXT NOT NULL,
    rfc           VARCHAR(13),
    plan          VARCHAR(20) NOT NULL DEFAULT 'basico'
                  CHECK (plan IN ('basico', 'profesional', 'enterprise')),
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activo        BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE tenants IS 'Comercios registrados en la plataforma SaaS.';


-- ============================================================
-- TABLA: usuarios
-- Cajeros y administradores de cada tenant.
-- PIN almacenado como hash (crypt + blowfish).
-- ============================================================
CREATE TABLE usuarios (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre        TEXT NOT NULL,
    email         TEXT,                        -- opcional para acceso web
    rol           VARCHAR(10) NOT NULL DEFAULT 'cajero'
                  CHECK (rol IN ('admin', 'cajero', 'supervisor')),
    pin_hash      TEXT,                         -- bcrypt via pgcrypto
    activo        BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_tenant ON usuarios(tenant_id);

COMMENT ON COLUMN usuarios.pin_hash
    IS 'Almacena crypt(pin, gen_salt(''bf'')). Nunca el PIN en texto plano.';


-- ============================================================
-- TABLA: categorias
-- Clasificación de productos por tenant.
-- ============================================================
CREATE TABLE categorias (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre_categoria TEXT NOT NULL,
    color_hex       VARCHAR(7) DEFAULT '#6366f1',   -- para UI
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, nombre_categoria)
);

CREATE INDEX idx_categorias_tenant ON categorias(tenant_id);


-- ============================================================
-- TABLA: productos
-- Compatible con estructura existente (código de barras,
-- descripción, precio compra/venta/mayoreo, stock, categoría).
-- Extiende con unidad de medida para kg/fracciones.
-- ============================================================
CREATE TABLE productos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    categoria_id    UUID REFERENCES categorias(id) ON DELETE SET NULL,

    -- Columnas compatibles con inventario existente
    codigo_barras   VARCHAR(50),
    descripcion     TEXT NOT NULL,
    precio_compra   NUMERIC(12, 4) NOT NULL DEFAULT 0,
    precio_venta    NUMERIC(12, 4) NOT NULL DEFAULT 0,
    precio_mayoreo  NUMERIC(12, 4),            -- equivale a "Mayoreo"
    stock_actual    NUMERIC(12, 4) NOT NULL DEFAULT 0,  -- NUMERIC para kg
    stock_minimo    NUMERIC(12, 4) NOT NULL DEFAULT 0,

    -- Extensión futura
    unidad_medida   VARCHAR(10) NOT NULL DEFAULT 'pza'
                    CHECK (unidad_medida IN ('pza', 'kg', 'litro', 'metro',
                                             'caja', 'docena', 'par')),
    imagen_url      TEXT,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unicidad: mismo código de barras no puede repetirse en un tenant
    UNIQUE (tenant_id, codigo_barras)
);

-- Índices críticos para búsqueda ultra-rápida en POS
CREATE INDEX idx_productos_tenant         ON productos(tenant_id);
CREATE INDEX idx_productos_barcode        ON productos(tenant_id, codigo_barras);
CREATE INDEX idx_productos_descripcion    ON productos USING gin(to_tsvector('spanish', descripcion));
CREATE INDEX idx_productos_bajo_stock     ON productos(tenant_id)
    WHERE stock_actual <= stock_minimo AND activo = TRUE;

COMMENT ON COLUMN productos.stock_actual
    IS 'NUMERIC para soportar fracciones (kg, litros). El trigger lo decrementa automáticamente.';


-- ============================================================
-- TABLA: clientes
-- Clientes por tenant, con soporte de crédito.
-- ============================================================
CREATE TABLE clientes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    telefono        VARCHAR(20),
    email           TEXT,
    limite_credito  NUMERIC(12, 2) NOT NULL DEFAULT 0,
    saldo_pendiente NUMERIC(12, 2) NOT NULL DEFAULT 0,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clientes_tenant ON clientes(tenant_id);


-- ============================================================
-- TABLA: caja_turnos
-- Control de apertura/cierre de turno por cajero.
-- ============================================================
CREATE TABLE caja_turnos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usuario_id      UUID NOT NULL REFERENCES usuarios(id),
    monto_apertura  NUMERIC(12, 2) NOT NULL DEFAULT 0,
    monto_cierre    NUMERIC(12, 2),
    estado          VARCHAR(10) NOT NULL DEFAULT 'abierto'
                    CHECK (estado IN ('abierto', 'cerrado')),
    fecha_apertura  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_cierre    TIMESTAMPTZ,
    notas           TEXT
);

CREATE INDEX idx_caja_turnos_tenant  ON caja_turnos(tenant_id);
CREATE INDEX idx_caja_turnos_abierto ON caja_turnos(tenant_id)
    WHERE estado = 'abierto';


-- ============================================================
-- TABLA: ventas
-- Encabezado de cada transacción de venta.
-- ============================================================
CREATE TABLE ventas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usuario_id      UUID NOT NULL REFERENCES usuarios(id),
    cliente_id      UUID REFERENCES clientes(id) ON DELETE SET NULL,
    turno_id        UUID REFERENCES caja_turnos(id),

    subtotal        NUMERIC(12, 4) NOT NULL DEFAULT 0,
    descuento       NUMERIC(12, 4) NOT NULL DEFAULT 0,
    total           NUMERIC(12, 4) NOT NULL DEFAULT 0,

    metodo_pago     VARCHAR(10) NOT NULL DEFAULT 'efectivo'
                    CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'mixto',
                                           'credito', 'transferencia')),
    monto_efectivo  NUMERIC(12, 2) NOT NULL DEFAULT 0,
    monto_tarjeta   NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cambio          NUMERIC(12, 2) NOT NULL DEFAULT 0,

    estado          VARCHAR(12) NOT NULL DEFAULT 'completada'
                    CHECK (estado IN ('completada', 'cancelada', 'pendiente')),
    folio           SERIAL,                    -- número legible para ticket
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ventas_tenant     ON ventas(tenant_id);
CREATE INDEX idx_ventas_fecha      ON ventas(tenant_id, creado_en DESC);
CREATE INDEX idx_ventas_cliente    ON ventas(cliente_id) WHERE cliente_id IS NOT NULL;


-- ============================================================
-- TABLA: detalles_ventas
-- Líneas de cada venta. El trigger descuenta stock aquí.
-- ============================================================
CREATE TABLE detalles_ventas (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id         UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id      UUID NOT NULL REFERENCES productos(id),
    cantidad         NUMERIC(12, 4) NOT NULL,
    precio_aplicado  NUMERIC(12, 4) NOT NULL,   -- precio en el momento de venta
    subtotal         NUMERIC(12, 4) NOT NULL
                     GENERATED ALWAYS AS (cantidad * precio_aplicado) STORED
);

CREATE INDEX idx_detalles_venta    ON detalles_ventas(venta_id);
CREATE INDEX idx_detalles_producto ON detalles_ventas(producto_id);


-- ============================================================
--  TRIGGER: Descuento automático de stock
--  Se ejecuta AFTER INSERT en detalles_ventas.
--  Lanza excepción si no hay stock suficiente.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_descontar_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stock_actual  NUMERIC;
    v_descripcion   TEXT;
BEGIN
    -- Leer stock actual con bloqueo para evitar race conditions
    SELECT stock_actual, descripcion
      INTO v_stock_actual, v_descripcion
      FROM productos
     WHERE id = NEW.producto_id
       FOR UPDATE;

    IF v_stock_actual IS NULL THEN
        RAISE EXCEPTION 'Producto % no encontrado.', NEW.producto_id;
    END IF;

    IF v_stock_actual < NEW.cantidad THEN
        RAISE EXCEPTION
            'Stock insuficiente para "%". Disponible: %, solicitado: %',
            v_descripcion, v_stock_actual, NEW.cantidad
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE productos
       SET stock_actual    = stock_actual - NEW.cantidad,
           actualizado_en  = NOW()
     WHERE id = NEW.producto_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_descontar_stock
    AFTER INSERT ON detalles_ventas
    FOR EACH ROW
    EXECUTE FUNCTION fn_descontar_stock();

COMMENT ON FUNCTION fn_descontar_stock()
    IS 'Descuenta automáticamente el stock al registrar una línea de venta. '
       'Usa FOR UPDATE para evitar race conditions en ventas concurrentes.';


-- ============================================================
--  TRIGGER: Actualizar actualizado_en en productos
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_actualizado_en()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_productos_updated
    BEFORE UPDATE ON productos
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_actualizado_en();


-- ============================================================
--  ROW LEVEL SECURITY (RLS)
--  Aislamiento estricto por tenant. Ningún usuario puede leer
--  ni escribir datos de otro tenant_id.
-- ============================================================

-- Habilitar RLS en todas las tablas con tenant_id
ALTER TABLE tenants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias       ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja_turnos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalles_ventas  ENABLE ROW LEVEL SECURITY;

-- ---- Función helper: obtener tenant_id de la sesión ----
-- El frontend debe incluir el tenant_id en app.tenant_id
-- via: supabase.rpc o set_config en cada sesión.
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
    SELECT NULLIF(
        current_setting('app.tenant_id', TRUE),
        ''
    )::UUID;
$$;

-- ---- Políticas: usuarios ----
CREATE POLICY "usuarios: solo su tenant"
    ON usuarios
    USING (tenant_id = public.get_tenant_id());

CREATE POLICY "usuarios: insertar en su tenant"
    ON usuarios FOR INSERT
    WITH CHECK (tenant_id = public.get_tenant_id());

-- ---- Políticas: categorias ----
CREATE POLICY "categorias: solo su tenant"
    ON categorias
    USING (tenant_id = public.get_tenant_id());

CREATE POLICY "categorias: insertar en su tenant"
    ON categorias FOR INSERT
    WITH CHECK (tenant_id = public.get_tenant_id());

-- ---- Políticas: productos ----
CREATE POLICY "productos: solo su tenant"
    ON productos
    USING (tenant_id = public.get_tenant_id());

CREATE POLICY "productos: insertar en su tenant"
    ON productos FOR INSERT
    WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "productos: actualizar en su tenant"
    ON productos FOR UPDATE
    USING (tenant_id = public.get_tenant_id())
    WITH CHECK (tenant_id = public.get_tenant_id());

-- ---- Políticas: clientes ----
CREATE POLICY "clientes: solo su tenant"
    ON clientes
    USING (tenant_id = public.get_tenant_id());

CREATE POLICY "clientes: insertar en su tenant"
    ON clientes FOR INSERT
    WITH CHECK (tenant_id = public.get_tenant_id());

-- ---- Políticas: caja_turnos ----
CREATE POLICY "caja_turnos: solo su tenant"
    ON caja_turnos
    USING (tenant_id = public.get_tenant_id());

CREATE POLICY "caja_turnos: insertar en su tenant"
    ON caja_turnos FOR INSERT
    WITH CHECK (tenant_id = public.get_tenant_id());

-- ---- Políticas: ventas ----
CREATE POLICY "ventas: solo su tenant"
    ON ventas
    USING (tenant_id = public.get_tenant_id());

CREATE POLICY "ventas: insertar en su tenant"
    ON ventas FOR INSERT
    WITH CHECK (tenant_id = public.get_tenant_id());

-- ---- Políticas: detalles_ventas ----
-- Acceso indirecto a través de la venta (JOIN con tenant_id)
CREATE POLICY "detalles_ventas: solo ventas de su tenant"
    ON detalles_ventas
    USING (
        EXISTS (
            SELECT 1 FROM ventas v
             WHERE v.id = venta_id
               AND v.tenant_id = public.get_tenant_id()
        )
    );

CREATE POLICY "detalles_ventas: insertar en venta de su tenant"
    ON detalles_ventas FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM ventas v
             WHERE v.id = venta_id
               AND v.tenant_id = public.get_tenant_id()
        )
    );

-- ---- Políticas: tenants (solo el propio) ----
CREATE POLICY "tenants: solo leer el propio"
    ON tenants FOR SELECT
    USING (id = public.get_tenant_id());


-- ============================================================
--  VISTA: productos_bajo_stock
--  Útil para el widget de alertas en tiempo real (Realtime).
-- ============================================================
CREATE OR REPLACE VIEW productos_bajo_stock AS
    SELECT
        p.id,
        p.tenant_id,
        p.descripcion,
        p.codigo_barras,
        p.stock_actual,
        p.stock_minimo,
        p.unidad_medida,
        c.nombre_categoria,
        CASE
            WHEN p.stock_actual = 0            THEN 'sin_stock'
            WHEN p.stock_actual < p.stock_minimo THEN 'critico'
            ELSE                                    'bajo'
        END AS nivel_alerta
    FROM productos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.activo = TRUE
      AND p.stock_actual <= p.stock_minimo;

COMMENT ON VIEW productos_bajo_stock
    IS 'Feed para el widget de alertas. Suscribir via Supabase Realtime en tabla productos.';


-- ============================================================
--  FUNCIÓN: buscar_producto_pos
--  Búsqueda dual por código de barras O texto (FTS).
--  Usada desde el input del escáner / F2.
-- ============================================================
CREATE OR REPLACE FUNCTION buscar_producto_pos(
    p_tenant_id UUID,
    p_query     TEXT,
    p_limit     INT DEFAULT 10
)
RETURNS TABLE (
    id              UUID,
    codigo_barras   VARCHAR,
    descripcion     TEXT,
    precio_venta    NUMERIC,
    precio_mayoreo  NUMERIC,
    stock_actual    NUMERIC,
    unidad_medida   VARCHAR,
    nombre_categoria TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.codigo_barras,
        p.descripcion,
        p.precio_venta,
        p.precio_mayoreo,
        p.stock_actual,
        p.unidad_medida,
        c.nombre_categoria
    FROM productos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.tenant_id   = p_tenant_id
      AND p.activo      = TRUE
      AND (
            p.codigo_barras = p_query                                  -- coincidencia exacta de barcode
         OR to_tsvector('spanish', p.descripcion)
            @@ plainto_tsquery('spanish', p_query)                     -- búsqueda full-text
         OR p.descripcion ILIKE '%' || p_query || '%'                  -- fallback ILIKE
      )
    ORDER BY
        (p.codigo_barras = p_query) DESC,   -- barcode exacto primero
        p.descripcion ASC
    LIMIT p_limit;
END;
$$;


-- ============================================================
--  FUNCIÓN: procesar_venta
--  Transacción atómica: inserta venta + detalles en un solo
--  llamado. El trigger fn_descontar_stock corre automáticamente.
-- ============================================================
CREATE OR REPLACE FUNCTION procesar_venta(
    p_tenant_id     UUID,
    p_usuario_id    UUID,
    p_cliente_id    UUID,
    p_turno_id      UUID,
    p_metodo_pago   VARCHAR,
    p_monto_efectivo NUMERIC,
    p_monto_tarjeta  NUMERIC,
    p_descuento      NUMERIC,
    p_items         JSONB  -- [{producto_id, cantidad, precio_aplicado}]
)
RETURNS UUID           -- id de la venta creada
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_venta_id  UUID;
    v_subtotal  NUMERIC := 0;
    v_total     NUMERIC;
    v_cambio    NUMERIC;
    v_item      JSONB;
BEGIN
    -- Calcular subtotal
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_subtotal := v_subtotal +
            (v_item->>'cantidad')::NUMERIC *
            (v_item->>'precio_aplicado')::NUMERIC;
    END LOOP;

    v_total  := v_subtotal - COALESCE(p_descuento, 0);
    v_cambio := GREATEST(0,
        COALESCE(p_monto_efectivo, 0) + COALESCE(p_monto_tarjeta, 0) - v_total
    );

    -- Insertar encabezado de venta
    INSERT INTO ventas (
        tenant_id, usuario_id, cliente_id, turno_id,
        subtotal, descuento, total,
        metodo_pago, monto_efectivo, monto_tarjeta, cambio
    ) VALUES (
        p_tenant_id, p_usuario_id, p_cliente_id, p_turno_id,
        v_subtotal, COALESCE(p_descuento, 0), v_total,
        p_metodo_pago,
        COALESCE(p_monto_efectivo, 0),
        COALESCE(p_monto_tarjeta, 0),
        v_cambio
    )
    RETURNING id INTO v_venta_id;

    -- Insertar líneas (el trigger descuenta stock por cada fila)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO detalles_ventas (venta_id, producto_id, cantidad, precio_aplicado)
        VALUES (
            v_venta_id,
            (v_item->>'producto_id')::UUID,
            (v_item->>'cantidad')::NUMERIC,
            (v_item->>'precio_aplicado')::NUMERIC
        );
    END LOOP;

    -- Actualizar saldo de crédito si aplica
    IF p_metodo_pago = 'credito' AND p_cliente_id IS NOT NULL THEN
        UPDATE clientes
           SET saldo_pendiente = saldo_pendiente + v_total
         WHERE id = p_cliente_id AND tenant_id = p_tenant_id;
    END IF;

    RETURN v_venta_id;
END;
$$;

COMMENT ON FUNCTION procesar_venta
    IS 'Inserta venta + detalles en una transacción atómica. '
       'El trigger fn_descontar_stock corre por cada línea insertada.';


-- ============================================================
--  PUBLICACIONES REALTIME (Supabase)
--  Para el widget de alertas y actualizaciones en vivo.
-- ============================================================
-- Habilita publicación de cambios en la tabla productos
-- (necesario para escuchar cambios de stock en tiempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE productos;
ALTER PUBLICATION supabase_realtime ADD TABLE ventas;


-- ============================================================
--  DATOS SEMILLA (para desarrollo)
-- ============================================================
DO $$
DECLARE
    v_tenant_id UUID;
    v_admin_id  UUID;
    v_cat1_id   UUID;
    v_cat2_id   UUID;
BEGIN
    -- Tenant demo
    INSERT INTO tenants (nombre_comercio, rfc, plan)
    VALUES ('Abarrotes Demo SA', 'ABAR010101ABC', 'profesional')
    RETURNING id INTO v_tenant_id;

    -- Admin
    INSERT INTO usuarios (tenant_id, nombre, rol, pin_hash)
    VALUES (v_tenant_id, 'Administrador', 'admin',
            extensions.crypt('1234', extensions.gen_salt('bf')))
    RETURNING id INTO v_admin_id;

    -- Cajero
    INSERT INTO usuarios (tenant_id, nombre, rol, pin_hash)
    VALUES (v_tenant_id, 'Cajero 1', 'cajero',
            extensions.crypt('5678', extensions.gen_salt('bf')));

    -- Categorías
    INSERT INTO categorias (tenant_id, nombre_categoria, color_hex)
    VALUES (v_tenant_id, 'Abarrotes', '#6366f1')
    RETURNING id INTO v_cat1_id;

    INSERT INTO categorias (tenant_id, nombre_categoria, color_hex)
    VALUES (v_tenant_id, 'Lácteos', '#0ea5e9')
    RETURNING id INTO v_cat2_id;

    -- Productos de ejemplo
    INSERT INTO productos
        (tenant_id, categoria_id, codigo_barras, descripcion,
         precio_compra, precio_venta, precio_mayoreo,
         stock_actual, stock_minimo, unidad_medida)
    VALUES
        (v_tenant_id, v_cat1_id, '7501000001', 'Arroz 1kg',
         14.00, 20.00, 18.00, 50, 10, 'kg'),
        (v_tenant_id, v_cat1_id, '7501000002', 'Frijol negro 1kg',
         18.00, 25.00, 22.00, 30, 5,  'kg'),
        (v_tenant_id, v_cat2_id, '7501000003', 'Leche entera 1L',
         19.00, 25.00, 23.00, 8,  10, 'litro'),  -- stock bajo: demo alerta
        (v_tenant_id, v_cat2_id, '7501000004', 'Crema 500ml',
         22.00, 30.00, 27.00, 0,  5,  'litro');  -- sin stock: demo alerta

    RAISE NOTICE 'Datos semilla insertados. Tenant ID: %', v_tenant_id;
END;
$$;


-- ============================================================
--  FIN DEL SCRIPT
-- ============================================================
