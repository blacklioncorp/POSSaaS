'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, ArrowLeft, Check, AlertCircle, RefreshCw, FileText, Database } from 'lucide-react'

interface CSVImportClientProps {
  tenantId: string
}

// Columns we support in our database
const DB_COLUMNS = [
  { key: 'descripcion', label: 'Descripción (Requerido)', required: true },
  { key: 'precio_venta', label: 'Precio Venta (Requerido)', required: true },
  { key: 'codigo_barras', label: 'Código de Barras', required: false },
  { key: 'precio_compra', label: 'Precio Compra', required: false },
  { key: 'precio_mayoreo', label: 'Precio Mayoreo', required: false },
  { key: 'stock_actual', label: 'Stock Actual', required: false },
  { key: 'stock_minimo', label: 'Stock Mínimo', required: false },
  { key: 'unidad_medida', label: 'Unidad de Medida (pza, kg, etc.)', required: false },
  { key: 'categoria_nombre', label: 'Categoría', required: false },
  { key: 'nombre_proveedor', label: 'Proveedor (Requerido)', required: true },
]

const VALID_UNITS = ['pza', 'kg', 'litro', 'metro', 'caja', 'docena', 'par']

// RFC 4180 compliant CSV parser in pure TypeScript
function parseCSV(text: string): string[][] {
  const result: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        row.push(cell)
        cell = ''
      } else if (char === '\r' || char === '\n') {
        row.push(cell)
        cell = ''
        if (row.length > 1 || row[0] !== '') {
          result.push(row)
        }
        row = []
        if (char === '\r' && nextChar === '\n') {
          i++
        }
      } else {
        cell += char
      }
    }
  }
  if (row.length > 0 || cell !== '') {
    row.push(cell)
    result.push(row)
  }
  return result
}

export function CSVImportClient({ tenantId }: CSVImportClientProps) {
  const router = useRouter()
  const [csvData, setCsvData] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)

  // Mapping state: maps DB Column Key -> CSV Column Index (or -1 if unmapped)
  const [mappings, setMappings] = useState<Record<string, number>>({})

  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importLogs, setImportLogs] = useState<string[]>([])
  const [importSummary, setImportSummary] = useState<{ success: number; errors: number } | null>(null)

  // ── Drag & Drop Handlers ───────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Por favor, selecciona un archivo .csv')
      return
    }
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      try {
        const parsed = parseCSV(text)
        if (parsed.length < 2) {
          alert('El archivo CSV debe contener al menos una fila de encabezado y una fila de datos.')
          return
        }
        const csvHeaders = parsed[0].map(h => h.trim())
        setHeaders(csvHeaders)
        setCsvData(parsed.slice(1))

        // Auto-match headers to DB columns
        const initialMappings: Record<string, number> = {}
        DB_COLUMNS.forEach(dbCol => {
          const matchedIdx = csvHeaders.findIndex(csvHeader => {
            const cleanHeader = csvHeader.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
            if (!cleanHeader) return false // prevent empty strings from matching

            const cleanDB = dbCol.key.toLowerCase().replace('_', ' ')
            
            if (cleanHeader === dbCol.key || cleanHeader === cleanDB) return true

            if (dbCol.key === 'codigo_barras') {
               return cleanHeader.includes('barras') || cleanHeader.includes('code') || cleanHeader === 'upc' || cleanHeader === 'ean' || cleanHeader === 'sku'
            }
            if (dbCol.key === 'descripcion') {
               return cleanHeader.includes('descripcion') || cleanHeader === 'producto' || cleanHeader === 'nombre' || cleanHeader === 'articulo'
            }
            if (dbCol.key === 'precio_venta') {
               return cleanHeader === 'precio venta' || cleanHeader === 'precio de venta' || cleanHeader === 'venta' || cleanHeader === 'precio publico' || cleanHeader === 'precio'
            }
            if (dbCol.key === 'precio_compra') {
               return cleanHeader === 'precio compra' || cleanHeader === 'precio de compra' || cleanHeader === 'compra' || cleanHeader === 'costo' || cleanHeader === 'costo unitario'
            }
            if (dbCol.key === 'precio_mayoreo') {
               return cleanHeader.includes('mayoreo') || cleanHeader.includes('mayorista')
            }
            if (dbCol.key === 'stock_actual') {
               return cleanHeader === 'stock' || cleanHeader === 'stock actual' || cleanHeader === 'inventario' || cleanHeader === 'cantidad' || cleanHeader === 'existencia'
            }
            if (dbCol.key === 'stock_minimo') {
               return cleanHeader === 'stock minimo' || cleanHeader === 'minimo'
            }
            if (dbCol.key === 'unidad_medida') {
               return cleanHeader === 'unidad' || cleanHeader === 'unidad de medida' || cleanHeader === 'medida' || cleanHeader === 'uom'
            }
            if (dbCol.key === 'categoria_nombre') {
               return cleanHeader.includes('categoria') || cleanHeader.includes('depto') || cleanHeader.includes('departamento') || cleanHeader.includes('linea') || cleanHeader.includes('familia')
            }
            if (dbCol.key === 'nombre_proveedor') {
               return cleanHeader.includes('proveedor') || cleanHeader.includes('marca') || cleanHeader.includes('fabricante') || cleanHeader.includes('distribuidor')
            }

            return false
          })
          initialMappings[dbCol.key] = matchedIdx
        })
        setMappings(initialMappings)
      } catch (err) {
        console.error(err)
        alert('Error al parsear el archivo CSV. Asegúrate de que tenga un formato correcto.')
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  // ── Change mappings manually ────────────────────────────
  const handleMapChange = (dbColKey: string, csvColIdx: number) => {
    setMappings(prev => ({
      ...prev,
      [dbColKey]: csvColIdx,
    }))
  }

  // ── Reset form ─────────────────────────────────────────
  const handleReset = () => {
    setCsvData([])
    setHeaders([])
    setFileName('')
    setMappings({})
    setImportSummary(null)
    setImportLogs([])
    setImportProgress(0)
  }

  // ── Mapped Row Preview Generator ────────────────────────
  const processedRows = useMemo(() => {
    return csvData.map((row, rowIdx) => {
      const item: Record<string, any> = {}
      const errors: string[] = []

      DB_COLUMNS.forEach(dbCol => {
        const csvIdx = mappings[dbCol.key]
        const rawValue = csvIdx !== undefined && csvIdx >= 0 ? row[csvIdx]?.trim() : ''

        if (dbCol.required && !rawValue) {
          errors.push(`Falta campo requerido: ${dbCol.label}`)
        }

        if (dbCol.key === 'precio_venta' || dbCol.key === 'precio_compra' || dbCol.key === 'precio_mayoreo') {
          if (rawValue) {
            const num = Number(rawValue.replace(/[^0-9.-]+/g, ""))
            if (isNaN(num)) {
              errors.push(`${dbCol.label} debe ser numérico`)
              item[dbCol.key] = 0
            } else if (num < 0) {
              errors.push(`${dbCol.label} no puede ser negativo`)
              item[dbCol.key] = 0
            } else {
              item[dbCol.key] = num
            }
          } else {
            item[dbCol.key] = 0
          }
        } else if (dbCol.key === 'stock_actual' || dbCol.key === 'stock_minimo') {
          if (rawValue) {
            const num = Number(rawValue)
            if (isNaN(num)) {
              errors.push(`${dbCol.label} debe ser un número`)
              item[dbCol.key] = 0
            } else {
              item[dbCol.key] = num
            }
          } else {
            item[dbCol.key] = 0
          }
        } else if (dbCol.key === 'unidad_medida') {
          const cleanUnit = rawValue.toLowerCase() || 'pza'
          if (rawValue && !VALID_UNITS.includes(cleanUnit)) {
            errors.push(`Unidad '${rawValue}' no válida (debe ser: ${VALID_UNITS.join(', ')})`)
          }
          item[dbCol.key] = cleanUnit
        } else {
          item[dbCol.key] = rawValue
        }
      })

      return {
        originalRow: row,
        mappedData: item,
        errors,
        isValid: errors.length === 0,
        rowNumber: rowIdx + 2, // 1-indexed plus header row
      }
    })
  }, [csvData, mappings])

  // Count valid and invalid rows
  const stats = useMemo(() => {
    const total = processedRows.length
    const valid = processedRows.filter(r => r.isValid).length
    const invalid = total - valid
    return { total, valid, invalid }
  }, [processedRows])

  // ── Import Execution ───────────────────────────────────
  const handleImport = async () => {
    if (stats.valid === 0) {
      alert('No hay filas válidas para importar.')
      return
    }

    setIsImporting(true)
    setImportProgress(0)
    setImportLogs(['Iniciando importación...'])
    setImportSummary(null)

    const validProducts = processedRows
      .filter(r => r.isValid)
      .map(r => r.mappedData)

    // Batch size of 100 products per API request
    const batchSize = 100
    const totalBatches = Math.ceil(validProducts.length / batchSize)
    let successCount = 0
    let errorCount = stats.invalid

    try {
      for (let i = 0; i < totalBatches; i++) {
        const batch = validProducts.slice(i * batchSize, (i + 1) * batchSize)
        setImportLogs(prev => [
          ...prev,
          `Enviando lote ${i + 1} de ${totalBatches} (${batch.length} productos)...`
        ])

        const res = await fetch(`/api/tenant/${tenantId}/productos/import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ products: batch }),
        })

        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Error al procesar lote en el servidor')
        }

        const data = await res.json()
        successCount += data.count
        setImportProgress(Math.round(((i + 1) / totalBatches) * 100))
      }

      setImportLogs(prev => [...prev, '¡Importación finalizada con éxito!'])
      setImportSummary({ success: successCount, errors: errorCount })
    } catch (err: any) {
      console.error(err)
      setImportLogs(prev => [...prev, `❌ Error: ${err.message}`])
      setImportSummary({ success: successCount, errors: validProducts.length - successCount + errorCount })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-zinc-900 pb-4">
        <button
          onClick={() => router.push(`/${tenantId}/dashboard`)}
          className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-emerald-400" />
            Importar Catálogo de Productos
          </h1>
          <p className="text-sm text-zinc-500">Migra tu inventario de Excel o CSV directamente a Supabase</p>
        </div>
      </header>

      {/* Main Flow Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Step 1: Upload or Mapping Controls */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Uploader Box */}
          {csvData.length === 0 ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-950/20'
                  : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60'
              }`}
            >
              <Upload className="h-12 w-12 text-zinc-600 mb-4 animate-bounce" />
              <h3 className="font-semibold text-zinc-300">Suelte su archivo CSV aquí</h3>
              <p className="text-xs text-zinc-500 mt-1 mb-4">Solo se soportan archivos codificados en UTF-8 (.csv)</p>
              
              <label className="cursor-pointer rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2.5 text-sm font-bold transition-colors shadow-lg shadow-emerald-500/10">
                Seleccionar Archivo
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-400" />
                  <span className="font-semibold truncate max-w-[180px]">{fileName}</span>
                </div>
                <button
                  onClick={handleReset}
                  disabled={isImporting}
                  className="text-xs text-red-500 hover:text-red-400 font-semibold"
                >
                  Cambiar archivo
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-zinc-950 p-2">
                  <p className="text-zinc-500">Filas</p>
                  <p className="text-lg font-bold">{stats.total}</p>
                </div>
                <div className="rounded-lg bg-zinc-950 p-2 border border-emerald-900/40">
                  <p className="text-emerald-500 font-medium">Válidas</p>
                  <p className="text-lg font-bold text-emerald-400">{stats.valid}</p>
                </div>
                <div className="rounded-lg bg-zinc-950 p-2 border border-red-950/40">
                  <p className="text-red-500 font-medium font-semibold">Errores</p>
                  <p className="text-lg font-bold text-red-400">{stats.invalid}</p>
                </div>
              </div>
            </div>
          )}

          {/* Mappings Form */}
          {csvData.length > 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">1. Asignar Columnas</h2>
              <p className="text-xs text-zinc-500">Asocia cada columna de tu base de datos con una de tu CSV.</p>
              
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {DB_COLUMNS.map((dbCol) => {
                  const mappedIdx = mappings[dbCol.key] ?? -1
                  return (
                    <div key={dbCol.key} className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400 flex items-center justify-between">
                        <span>{dbCol.label}</span>
                        {dbCol.required && mappedIdx === -1 && (
                          <span className="text-[10px] text-red-500 font-bold uppercase">Mapeo Requerido</span>
                        )}
                      </label>
                      <select
                        value={mappedIdx}
                        onChange={(e) => handleMapChange(dbCol.key, Number(e.target.value))}
                        disabled={isImporting}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      >
                        <option value={-1}>-- No mapeado --</option>
                        {headers.map((h, idx) => (
                          <option key={idx} value={idx}>
                            Columna {idx + 1}: {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={handleImport}
                disabled={isImporting || stats.valid === 0}
                className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black py-3 text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Iniciar Importación ({stats.valid} productos)
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Live Preview & Progress Logs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Progress / Result Area */}
          {(isImporting || importSummary) && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Estado de la Migración</h3>
              
              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-emerald-400">{isImporting ? 'Cargando registros...' : 'Importación Finalizada'}</span>
                  <span>{importProgress}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-zinc-950 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>

              {/* Summary Results */}
              {importSummary && (
                <div className="grid grid-cols-2 gap-4 rounded-xl bg-zinc-950/80 p-4 border border-zinc-800">
                  <div>
                    <p className="text-xs text-zinc-500">Productos Importados</p>
                    <p className="text-2xl font-bold text-emerald-400">{importSummary.success}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Productos con Errores u Omisiones</p>
                    <p className="text-2xl font-bold text-red-400">{importSummary.errors}</p>
                  </div>
                </div>
              )}

              {/* Logs */}
              <div className="rounded-xl bg-zinc-950 p-4 font-mono text-[11px] text-zinc-400 h-32 overflow-y-auto border border-zinc-800 space-y-1">
                {importLogs.map((log, idx) => (
                  <p key={idx}>{log}</p>
                ))}
              </div>
            </div>
          )}

          {/* Table Preview */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
              {csvData.length > 0 ? '2. Vista Previa de Datos Mapeados (Primeras 5 Filas)' : 'Instrucciones de Archivo'}
            </h2>
            
            {csvData.length === 0 ? (
              <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
                <p>Para migrar tus productos de manera correcta, sube un archivo CSV con las siguientes especificaciones:</p>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li>El archivo debe incluir una fila de **encabezado** con los nombres de las columnas.</li>
                  <li>Las columnas obligatorias son **Descripción** y **Precio Venta**.</li>
                  <li>La **Unidad de Medida** debe ser alguna de las siguientes: <code className="bg-zinc-950 px-1 rounded text-emerald-400">pza</code>, <code className="bg-zinc-950 px-1 rounded text-emerald-400">kg</code>, <code className="bg-zinc-950 px-1 rounded text-emerald-400">litro</code>, <code className="bg-zinc-950 px-1 rounded text-emerald-400">metro</code>, <code className="bg-zinc-950 px-1 rounded text-emerald-400">caja</code>, <code className="bg-zinc-950 px-1 rounded text-emerald-400">docena</code>, <code className="bg-zinc-950 px-1 rounded text-emerald-400">par</code>.</li>
                  <li>Si la categoría no existe en el sistema, la importación la creará automáticamente para este comercio.</li>
                  <li>Si un código de barras ya existe, se **actualizará (upsert)** el producto existente con la información del archivo.</li>
                </ul>
              </div>
            ) : (
              <div className="overflow-x-auto border border-zinc-800 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-950 text-zinc-500 uppercase font-semibold border-b border-zinc-800">
                    <tr>
                      <th className="px-3 py-2">Fila</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Barcode</th>
                      <th className="px-3 py-2">Descripción</th>
                      <th className="px-3 py-2 text-right">Compra</th>
                      <th className="px-3 py-2 text-right">Venta</th>
                      <th className="px-3 py-2 text-right text-emerald-400">Ganancia</th>
                      <th className="px-3 py-2 text-right">Stock</th>
                      <th className="px-3 py-2">Unidad</th>
                      <th className="px-3 py-2">Categoría</th>
                      <th className="px-3 py-2">Proveedor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {processedRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className={`hover:bg-zinc-850 transition-colors ${!row.isValid ? 'bg-red-950/20' : ''}`}>
                        <td className="px-3 py-2.5 text-zinc-500">{row.rowNumber}</td>
                        <td className="px-3 py-2.5">
                          {row.isValid ? (
                            <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[10px] font-bold">Válido</span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span
                                className="rounded-full bg-red-500/20 text-red-400 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 w-max"
                              >
                                <AlertCircle className="h-3 w-3" />
                                Error
                              </span>
                              <span className="text-[9px] text-red-400 leading-tight max-w-[150px]">{row.errors[0]}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono">{row.mappedData.codigo_barras || '-'}</td>
                        <td className="px-3 py-2.5 font-medium truncate max-w-[150px]">{row.mappedData.descripcion || '-'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-zinc-400">${Number(row.mappedData.precio_compra || 0).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-emerald-400 font-semibold">${Number(row.mappedData.precio_venta || 0).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-emerald-300 font-bold">${(Number(row.mappedData.precio_venta || 0) - Number(row.mappedData.precio_compra || 0)).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{Number(row.mappedData.stock_actual || 0)}</td>
                        <td className="px-3 py-2.5">{row.mappedData.unidad_medida}</td>
                        <td className="px-3 py-2.5 text-zinc-400 truncate max-w-[100px]">{row.mappedData.categoria_nombre || '-'}</td>
                        <td className="px-3 py-2.5 text-zinc-400 truncate max-w-[100px]">{row.mappedData.nombre_proveedor || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}
