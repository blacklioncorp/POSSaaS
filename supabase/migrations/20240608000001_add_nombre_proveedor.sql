-- Añadir columna de nombre_proveedor a la tabla productos
ALTER TABLE productos
ADD COLUMN nombre_proveedor TEXT NOT NULL DEFAULT 'Sin Proveedor';

-- Quitar el valor por defecto si se desea que sea estricto en nuevos inserts, 
-- pero para los registros existentes se necesita un valor por defecto.
ALTER TABLE productos
ALTER COLUMN nombre_proveedor DROP DEFAULT;

COMMENT ON COLUMN productos.nombre_proveedor IS 'Nombre del proveedor, obligatorio para cada producto.';
