import Image from "next/image"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { formatCurrency } from "@/lib/utils"

interface InvoiceOdooTemplateProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoice: any
  settings?: {
    companyName: string
    companyRnc: string
    companyPhone: string
    companyAddress: string
    companyLogo?: string
  }
}

export function InvoiceOdooTemplate({ invoice, settings }: InvoiceOdooTemplateProps) {
  const companyName = settings?.companyName || "FacturaDO"
  const companyRnc = settings?.companyRnc || "101-00000-0"
  const companyAddress = settings?.companyAddress || "Av. Winston Churchill #101"
  const companyPhone = settings?.companyPhone || "809-555-0101"
  const logoSrc = settings?.companyLogo && settings.companyLogo.length > 0 ? settings.companyLogo : "/logo.png"

  const issueDate = new Date(invoice.createdAt)

  const subtotal = invoice.items.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (acc: number, item: any) => acc + Number(item.price) * item.quantity,
    0
  )

  const tax = Number(invoice.tax ?? 0)
  const shipping = Number(invoice.shippingCost ?? 0)
  const total = Number(invoice.total ?? subtotal + tax + shipping)

  return (
    <div className="font-sans text-sm w-[210mm] p-8 bg-white text-black mx-auto">
      <style>{`
        @media print {
          @page { margin: 10mm; size: A4 portrait; }
          body { width: 210mm; }
        }
      `}</style>

      {/* Header */}
      <header className="flex items-start justify-between border-b pb-4 mb-6">
        <div className="flex items-start gap-4">
          <Image
            src={logoSrc}
            alt="Logo"
            width={60}
            height={60}
            className="h-14 w-14 object-contain"
            unoptimized
          />
          <div>
            <h1 className="text-xl font-bold uppercase">{companyName}</h1>
            <p className="text-xs">
              {companyAddress}
              <br />
              Tel: {companyPhone}
            </p>
            {companyRnc && (
              <p className="text-xs mt-1">
                RNC: <span className="font-medium">{companyRnc}</span>
              </p>
            )}
          </div>
        </div>

        <div className="text-right text-xs space-y-1">
          <p className="text-lg font-bold uppercase">FACTURA</p>
          <p>
            <span className="font-semibold">No. interno:</span>{" "}
            {invoice.sequenceNumber}
          </p>
          {invoice.ncf && (
            <p>
              <span className="font-semibold">NCF:</span> {invoice.ncf}
            </p>
          )}
          {invoice.ncfType && (
            <p>
              <span className="font-semibold">Tipo NCF:</span> {invoice.ncfType}
            </p>
          )}
          <p>
            <span className="font-semibold">Fecha:</span>{" "}
            {format(issueDate, "dd/MM/yyyy HH:mm", { locale: es })}
          </p>
          {invoice.createdBy?.name && (
            <p className="italic">
              Atendido por: <span className="font-medium">{invoice.createdBy.name}</span>
            </p>
          )}
        </div>
      </header>

      {/* Datos del cliente */}
      <section className="mb-6 grid grid-cols-2 gap-6 text-xs">
        <div className="border rounded p-3 space-y-1">
          <h2 className="text-sm font-semibold mb-1">Cliente</h2>
          <p>
            <span className="font-semibold">Nombre:</span>{" "}
            {invoice.clientName || invoice.client?.name || "Consumidor Final"}
          </p>
          {(invoice.client?.rnc || invoice.clientRnc) && (
            <p>
              <span className="font-semibold">RNC/Cédula:</span>{" "}
              {invoice.client?.rnc || invoice.clientRnc}
            </p>
          )}
          {invoice.client?.address && (
            <p>
              <span className="font-semibold">Dirección:</span>{" "}
              {invoice.client.address}
            </p>
          )}
          {invoice.client?.phone && (
            <p>
              <span className="font-semibold">Teléfono:</span>{" "}
              {invoice.client.phone}
            </p>
          )}
        </div>

        <div className="border rounded p-3 space-y-1">
          <h2 className="text-sm font-semibold mb-1">Detalles de Facturación</h2>
          {invoice.paymentMethod && (
            <p>
              <span className="font-semibold">Forma de pago:</span>{" "}
              {invoice.paymentMethod}
            </p>
          )}
          {invoice.deliveryDate && (
            <p>
              <span className="font-semibold">Fecha de entrega:</span>{" "}
              {format(new Date(invoice.deliveryDate), "dd/MM/yyyy", { locale: es })}
            </p>
          )}
          {invoice.status && (
            <p>
              <span className="font-semibold">Estado:</span>{" "}
              {invoice.status === "PAID" ? "PAGADA" : invoice.status}
            </p>
          )}
          {invoice.notes && (
            <p>
              <span className="font-semibold">Notas:</span> {invoice.notes}
            </p>
          )}
        </div>
      </section>

      {/* Detalle de líneas */}
      <section className="mb-6">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 text-left w-1/2">Descripción</th>
              <th className="border px-2 py-1 text-right w-1/8">Cant.</th>
              <th className="border px-2 py-1 text-right w-1/8">Precio</th>
              <th className="border px-2 py-1 text-right w-1/8">Total</th>
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {invoice.items.map((item: any) => (
              <tr key={item.id}>
                <td className="border px-2 py-1 align-top">
                  <div className="font-medium">{item.productName}</div>
                  {item.description && (
                    <div className="text-[10px] text-gray-600">
                      {item.description}
                    </div>
                  )}
                </td>
                <td className="border px-2 py-1 text-right align-top">
                  {item.quantity}
                </td>
                <td className="border px-2 py-1 text-right align-top">
                  {formatCurrency(Number(item.price))}
                </td>
                <td className="border px-2 py-1 text-right align-top font-semibold">
                  {formatCurrency(Number(item.price) * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Totales */}
      <section className="flex justify-end mb-8">
        <div className="w-64 text-xs space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>ITBIS:</span>
            <span>{formatCurrency(tax)}</span>
          </div>
          {shipping > 0 && (
            <div className="flex justify-between">
              <span>Envío:</span>
              <span>{formatCurrency(shipping)}</span>
            </div>
          )}
          <div className="border-t mt-1 pt-2 flex justify-between text-sm font-bold">
            <span>Total:</span>
            <span>{formatCurrency(total)}</span>
          </div>
          {invoice.status === "PENDIENTE" && typeof invoice.balance !== "undefined" && (
            <div className="mt-2 text-red-700 font-semibold flex justify-between">
              <span>Pendiente:</span>
              <span>{formatCurrency(Number(invoice.balance))}</span>
            </div>
          )}
        </div>
      </section>

      {/* Pie de página */}
      <footer className="text-center text-[10px] text-gray-500 border-t pt-4">
        <p>Gracias por su preferencia.</p>
        <p>Factura generada por FacturaDO.</p>
      </footer>
    </div>
  )
}
