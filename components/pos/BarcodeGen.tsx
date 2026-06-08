// =============================================================
//  components/pos/BarcodeGen.tsx
//  Generador e impresor de códigos de barras.
//  Usa JsBarcode (CDN). Auto-genera código si el producto
//  no tiene uno asignado. Permite impresión directa.
// =============================================================
'use client'

import { useEffect, useRef, useState } from 'react'

interface BarcodeGenProps {
  value?: string          // código existente o undefined para auto-generar
  descripcion: string
  precio?: number
  onGenerated?: (codigo: string) => void
  printOnMount?: boolean
}

// Genera un EAN-13 interno con prefijo 200 (uso interno, no registrado)
function generarCodigoInterno(): string {
  const base = '200' + Date.now().toString().slice(-9)  // 12 dígitos
  const digits = base.split('').map(Number)
  // Dígito verificador EAN-13
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0)
  const check = (10 - (sum % 10)) % 10
  return base + check
}

export function BarcodeGen({
  value,
  descripcion,
  precio,
  onGenerated,
  printOnMount = false,
}: BarcodeGenProps) {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const [codigo, setCodigo] = useState(value ?? '')
  const [ready, setReady]   = useState(false)
  const [error, setError]   = useState('')

  // Cargar JsBarcode desde CDN y renderizar
  useEffect(() => {
    const c = value || generarCodigoInterno()
    setCodigo(c)
    if (!value && onGenerated) onGenerated(c)

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js'
    script.onload = () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window as any).JsBarcode(canvasRef.current, c, {
          format: 'EAN13',
          width: 2,
          height: 60,
          displayValue: true,
          fontOptions: 'bold',
          fontSize: 14,
          margin: 8,
          background: '#ffffff',
          lineColor: '#000000',
        })
        setReady(true)
        if (printOnMount) setTimeout(() => window.print(), 300)
      } catch {
        setError('Formato de código inválido')
      }
    }
    document.head.appendChild(script)
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=400,height=300')
    if (!printWin || !canvasRef.current) return

    const imgData = canvasRef.current.toDataURL('image/png')
    printWin.document.write(`
      <html><head>
        <title>Código: ${codigo}</title>
        <style>
          @page { size: 60mm 30mm; margin: 2mm; }
          body { margin: 0; display: flex; flex-direction: column;
                 align-items: center; font-family: monospace; }
          img  { max-width: 100%; }
          p    { font-size: 8pt; margin: 2px 0; text-align: center; }
        </style>
      </head><body>
        <p style="font-weight:bold;font-size:9pt">${descripcion}</p>
        <img src="${imgData}" />
        ${precio !== undefined ? `<p>$${precio.toFixed(2)}</p>` : ''}
      </body></html>
    `)
    printWin.document.close()
    printWin.focus()
    printWin.print()
    printWin.close()
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-4">
      <p className="text-xs font-medium text-zinc-400 text-center truncate max-w-full">
        {descripcion}
      </p>

      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : (
        <div className="rounded-lg bg-white p-2">
          <canvas ref={canvasRef} />
        </div>
      )}

      {ready && (
        <div className="flex items-center gap-2 w-full">
          <code className="flex-1 rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 text-center">
            {codigo}
          </code>
          <button
            onClick={handlePrint}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 transition-colors"
          >
            Imprimir
          </button>
        </div>
      )}

      {!value && (
        <p className="text-xs text-amber-400 text-center">
          ⚠ Código generado automáticamente — guárdalo en el producto
        </p>
      )}
    </div>
  )
}
