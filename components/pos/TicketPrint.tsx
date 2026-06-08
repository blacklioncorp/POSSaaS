// =============================================================
//  components/pos/TicketPrint.tsx
//  Ticket térmico — compatible con impresoras de 58mm y 80mm.
//  Usa @media print para ocultar todo el layout web.
//  Llamar window.print() desde el botón de imprimir.
// =============================================================
'use client'

import { forwardRef } from 'react'
import type { ItemCarrito } from '@/types/pos.types'

interface TicketPrintProps {
  folio: number
  fecha: Date
  items: ItemCarrito[]
  subtotal: number
  descuento: number
  total: number
  cambio: number
  metodoPago: string
  nombreComercio: string
  rfc?: string
  cajero: string
  clienteNombre?: string
  anchoMm?: 58 | 80
}

// Este componente se renderiza siempre en el DOM pero está
// OCULTO via CSS. Solo aparece al imprimir (@media print).
export const TicketPrint = forwardRef<HTMLDivElement, TicketPrintProps>(
  function TicketPrint({
    folio, fecha, items, subtotal, descuento, total, cambio,
    metodoPago, nombreComercio, rfc, cajero, clienteNombre,
    anchoMm = 80,
  }, ref) {
    const dateStr = fecha.toLocaleDateString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
    const timeStr = fecha.toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit',
    })

    return (
      <>
        {/*
          Estilos de impresión inyectados como <style> global.
          - Oculta TODA la app web y muestra solo .ticket-print
          - Define márgenes para papel térmico 58mm / 80mm
          - Fuente monospace para alineación perfecta
        */}
        <style>{`
          @media print {
            /* Ocultar todo */
            body > * { display: none !important; }
            body > #ticket-portal { display: block !important; }

            /* Eliminar márgenes del navegador */
            @page {
              margin: 4mm 2mm;
              size: ${anchoMm}mm auto;
            }

            body {
              background: white !important;
            }

            .ticket-print {
              display: block !important;
              width: ${anchoMm === 58 ? '52mm' : '72mm'};
              font-family: 'Courier New', Courier, monospace;
              font-size: ${anchoMm === 58 ? '8pt' : '9pt'};
              color: #000 !important;
              background: #fff !important;
              padding: 0;
              margin: 0 auto;
            }

            .ticket-print * {
              color: #000 !important;
              background: transparent !important;
              border-color: #000 !important;
            }

            /* Evitar corte de página dentro del ticket */
            .ticket-print { page-break-inside: avoid; }
          }

          /* Ocultar en pantalla — solo visible al imprimir */
          .ticket-print { display: none; }
        `}</style>

        {/* Portal de impresión */}
        <div id="ticket-portal">
          <div ref={ref} className="ticket-print">

            {/* Encabezado */}
            <div style={{ textAlign: 'center', marginBottom: '4px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.1em', textTransform: 'uppercase' }}>
                {nombreComercio}
              </div>
              {rfc && <div>RFC: {rfc}</div>}
              <div style={{ fontSize: '0.85em' }}>{dateStr} {timeStr}</div>
              <div style={{ fontSize: '0.85em' }}>Folio: #{String(folio).padStart(6, '0')}</div>
              <div style={{ fontSize: '0.85em' }}>Cajero: {cajero}</div>
              {clienteNombre && <div style={{ fontSize: '0.85em' }}>Cliente: {clienteNombre}</div>}
            </div>

            <Separator />

            {/* Encabezado columnas */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', fontWeight: 'bold' }}>
              <span style={{ flex: 3 }}>Descripción</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Cant</span>
              <span style={{ flex: 1.5, textAlign: 'right' }}>P.U.</span>
              <span style={{ flex: 1.5, textAlign: 'right' }}>Importe</span>
            </div>

            <Separator char="-" />

            {/* Líneas de venta */}
            {items.map((item, i) => (
              <div key={i}>
                {/* Descripción en línea propia si es larga */}
                <div style={{ fontSize: '0.85em', wordBreak: 'break-word' }}>
                  {item.producto.descripcion}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em' }}>
                  <span style={{ flex: 3 }}></span>
                  <span style={{ flex: 1, textAlign: 'right' }}>
                    {item.cantidad}{item.producto.unidad_medida !== 'pza' ? item.producto.unidad_medida : ''}
                  </span>
                  <span style={{ flex: 1.5, textAlign: 'right' }}>
                    {item.precio_aplicado.toFixed(2)}
                  </span>
                  <span style={{ flex: 1.5, textAlign: 'right', fontWeight: 'bold' }}>
                    {item.subtotal.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}

            <Separator />

            {/* Totales */}
            <TotalRow label="Subtotal" value={subtotal} />
            {descuento > 0 && <TotalRow label="Descuento" value={-descuento} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.05em' }}>
              <span>TOTAL</span>
              <span>${total.toFixed(2)}</span>
            </div>

            <Separator char="-" />

            {/* Forma de pago */}
            <TotalRow label={`Pago (${metodoPago})`} value={total + cambio} />
            {cambio > 0 && <TotalRow label="Cambio" value={cambio} />}

            <Separator />

            {/* Pie */}
            <div style={{ textAlign: 'center', fontSize: '0.8em', marginTop: '4px' }}>
              <div>¡Gracias por su compra!</div>
              <div>Conserve su ticket</div>
            </div>

            {/* Espacio para corte */}
            <div style={{ marginTop: '12px' }}></div>
          </div>
        </div>
      </>
    )
  }
)

// ── Helpers visuales ────────────────────────────────────────
function Separator({ char = '=' }: { char?: string }) {
  return (
    <div style={{ borderTop: `1px ${char === '=' ? 'double' : 'dashed'} #000`, margin: '3px 0' }} />
  )
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em' }}>
      <span>{label}</span>
      <span style={{ color: value < 0 ? '#000' : '#000' }}>
        {value < 0 ? '-' : ''}${Math.abs(value).toFixed(2)}
      </span>
    </div>
  )
}
