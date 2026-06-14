import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server-client'

const VALID_UNITS = ['pza', 'kg', 'litro', 'metro', 'caja', 'docena', 'par']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const supabase = createServerClient()

  try {
    const body = await request.json()
    const { products } = body

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'No products provided or invalid format' }, { status: 400 })
    }

    // 1. Get unique category names from payload
    const categoryNames = Array.from(
      new Set(
        products
          .map((p: any) => p.categoria_nombre?.trim())
          .filter((name): name is string => typeof name === 'string' && name.length > 0)
      )
    )

    // 2. Fetch existing categories
    const { data: existingCats, error: fetchCatsError } = await supabase
      .from('categorias')
      .select('id, nombre_categoria')
      .eq('tenant_id', tenantId)

    if (fetchCatsError) throw fetchCatsError

    const catMap = new Map<string, string>() // Name in lowercase -> UUID
    existingCats?.forEach((c: any) => {
      catMap.set(c.nombre_categoria.toLowerCase(), c.id)
    })

    // 3. Create missing categories on the fly
    for (const catName of categoryNames) {
      const lowerName = catName.toLowerCase()
      if (!catMap.has(lowerName)) {
        const { data: newCat, error: insertCatError } = await supabase
          .from('categorias')
          .insert({
            tenant_id: tenantId,
            nombre_categoria: catName,
          })
          .select('id')
          .single()

        if (insertCatError) {
          console.error(`Failed to create category: ${catName}`, insertCatError)
          // Skip creation and fall back to null category for now
          continue
        }

        if (newCat) {
          catMap.set(lowerName, newCat.id)
        }
      }
    }

    // 4. Map and prepare products for database
    const preparedProducts = products.map((p: any) => {
      const catName = p.categoria_nombre?.trim()?.toLowerCase()
      const categoria_id = catName ? catMap.get(catName) || null : null

      const unit = p.unidad_medida?.trim()?.toLowerCase()
      const unidad_medida = VALID_UNITS.includes(unit) ? unit : 'pza'

      // If barcode is empty, set to null to avoid constraint violation on empty string
      const barcode = p.codigo_barras?.trim() || null

      return {
        tenant_id: tenantId,
        categoria_id,
        codigo_barras: barcode,
        descripcion: p.descripcion?.trim() || 'Producto sin descripción',
        precio_compra: Number(p.precio_compra) || 0,
        precio_venta: Number(p.precio_venta) || 0,
        precio_mayoreo: p.precio_mayoreo ? Number(p.precio_mayoreo) : null,
        stock_actual: Number(p.stock_actual) || 0,
        stock_minimo: Number(p.stock_minimo) || 0,
        unidad_medida,
        activo: true,
        nombre_proveedor: p.nombre_proveedor?.trim() || 'Sin Proveedor',
      }
    })

    // 4.5 Deduplicate products by barcode within the same batch to prevent ON CONFLICT DO UPDATE error
    const uniqueProductsMap = new Map<string, any>()
    const nullBarcodeProducts: any[] = []

    preparedProducts.forEach(p => {
      if (p.codigo_barras) {
        uniqueProductsMap.set(p.codigo_barras, p) // Last one wins if duplicates exist
      } else {
        nullBarcodeProducts.push(p) // Null barcodes don't conflict
      }
    })

    const finalProductsToUpsert = [...Array.from(uniqueProductsMap.values()), ...nullBarcodeProducts]

    // 5. Batch upsert products
    const { data, error: upsertError } = await supabase
      .from('productos')
      .upsert(finalProductsToUpsert, {
        onConflict: 'tenant_id,codigo_barras',
      })

    if (upsertError) throw upsertError

    return NextResponse.json({
      success: true,
      count: preparedProducts.length,
    })
  } catch (err: any) {
    console.error('Error during CSV import:', err)
    return NextResponse.json({ error: err.message || 'Unknown database error' }, { status: 500 })
  }
}
