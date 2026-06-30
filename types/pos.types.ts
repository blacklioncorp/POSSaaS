// =============================================================
//  types/pos.types.ts
//  Tipos centrales del sistema POS
// =============================================================

export type UnidadMedida = 'pza' | 'kg' | 'litro' | 'metro' | 'caja' | 'docena' | 'par'
export type MetodoPago = 'efectivo' | 'tarjeta' | 'mixto' | 'credito' | 'transferencia'
export type NivelAlerta = 'sin_stock' | 'critico' | 'bajo'
export type RolUsuario = 'admin' | 'cajero' | 'supervisor'

export interface Producto {
  id: string
  tenant_id: string
  categoria_id: string | null
  codigo_barras: string | null
  descripcion: string
  precio_compra: number
  precio_venta: number
  precio_mayoreo: number | null
  stock_actual: number
  stock_minimo: number
  unidad_medida: UnidadMedida
  imagen_url: string | null
  activo: boolean
  nombre_categoria?: string | null
  nombre_proveedor: string
}

export interface ItemCarrito {
  producto: Producto
  cantidad: number
  precio_aplicado: number   // puede diferir del precio_venta (mayoreo, descuento)
  subtotal: number
}

export interface SaleTab {
  id: string            // 'venta-1' | 'venta-2' | 'venta-3'
  label: string
  items: ItemCarrito[]
  cliente_id: string | null
  descuento: number
}

export interface Cliente {
  id: string
  tenant_id: string
  nombre: string
  telefono: string | null
  limite_credito: number
  saldo_pendiente: number
}

export interface ProductoBajoStock {
  id: string
  tenant_id: string
  descripcion: string
  codigo_barras: string | null
  stock_actual: number
  stock_minimo: number
  unidad_medida: UnidadMedida
  nombre_categoria: string | null
  nivel_alerta: NivelAlerta
}

export interface Usuario {
  id: string
  tenant_id: string
  nombre: string
  rol: RolUsuario
}

export interface PagoPayload {
  metodo_pago: MetodoPago
  monto_efectivo: number
  monto_tarjeta: number
  cliente_id: string | null
  descuento: number
}

export interface VentaResult {
  venta_id: string
  folio: number
  total: number
  cambio: number
}

export interface HistorialPrecio {
  id: string
  tenant_id: string
  producto_id: string
  nombre_proveedor: string
  precio_compra: number
  precio_anterior: number | null
  cantidad: number
  notas: string | null
  creado_en: string
  descripcion_producto?: string
}
