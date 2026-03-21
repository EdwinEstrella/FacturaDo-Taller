import Image from "next/image"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { formatCurrency } from "@/lib/utils"

interface QuoteItem {
    id: string
    productName: string
    price: number
    quantity: number
}

interface Quote {
    id: string
    createdAt: Date | string
    status: string
    total: number
    client?: {
        name?: string
        rnc?: string
        address?: string
        phone?: string
        email?: string
    }
    createdBy?: {
        name: string
    }
    items: QuoteItem[]
}

interface CompanySettings {
    companyName: string
    companyRnc: string
    companyPhone: string
    companyAddress: string
    companyLogo?: string
}

interface QuoteOdooTemplateProps {
  quote: Quote
  settings?: CompanySettings
}

export function QuoteOdooTemplate({ quote, settings }: QuoteOdooTemplateProps) {
  const companyName = settings?.companyName || "FacturaDO"
  const companyRnc = settings?.companyRnc || "101-00000-0"
  const companyAddress = settings?.companyAddress || "Av. Winston Churchill #101"
  const companyPhone = settings?.companyPhone || "809-555-0101"
  const logoSrc = settings?.companyLogo && settings.companyLogo.length > 0 ? settings.companyLogo : "/logo.png"

  const issueDate = new Date(quote.createdAt)

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
          <p className="text-lg font-bold uppercase">COTIZACIÓN</p>
          <p>
            <span className="font-semibold">No.:</span>{" "}
            {quote.id.slice(-8).toUpperCase()}
          </p>
          <p>
            <span className="font-semibold">Fecha:</span>{" "}
            {format(issueDate, "dd/MM/yyyy HH:mm", { locale: es })}
          </p>
          <p>
            <span className="font-semibold">Válido hasta:</span>{" "}
            {format(new Date(issueDate.getTime() + 15 * 24 * 60 * 60 * 1000), "dd/MM/yyyy", { locale: es })}
          </p>
          <p>
            <span className="font-semibold">Estado:</span>{" "}
            {quote.status === "PENDING" ? "Pendiente" : quote.status}
          </p>
          {quote.createdBy?.name && (
            <p className="italic">
              Atendido por: <span className="font-medium">{quote.createdBy.name}</span>
            </p>
          )}
        </div>
      </header>

      {/* Datos del cliente */}
      <section className="mb-6 text-xs">
        <div className="border rounded p-3 space-y-1">
          <h2 className="text-sm font-semibold mb-1">Cliente</h2>
          <p>
            <span className="font-semibold">Nombre:</span>{" "}
            {quote.client?.name || "Cliente"}
          </p>
          {quote.client?.rnc && (
            <p>
              <span className="font-semibold">RNC/Cédula:</span>{" "}
              {quote.client.rnc}
            </p>
          )}
          {quote.client?.address && (
            <p>
              <span className="font-semibold">Dirección:</span>{" "}
              {quote.client.address}
            </p>
          )}
          {quote.client?.phone && (
            <p>
              <span className="font-semibold">Teléfono:</span>{" "}
              {quote.client.phone}
            </p>
          )}
          {quote.client?.email && (
            <p>
              <span className="font-semibold">Email:</span>{" "}
              {quote.client.email}
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
            {quote.items.map((item: QuoteItem) => (
              <tr key={item.id}>
                <td className="border px-2 py-1 align-top">
                  <div className="font-medium">{item.productName}</div>
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
          <div className="border-t mt-1 pt-2 flex justify-between text-sm font-bold">
            <span>Total:</span>
            <span>{formatCurrency(Number(quote.total))}</span>
          </div>
        </div>
      </section>

      {/* Términos y condiciones */}
      <section className="mb-6 p-3 bg-gray-50 border rounded text-xs">
        <h3 className="font-semibold mb-2">Términos y Condiciones</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Esta cotización es válida por 15 días a partir de la fecha de emisión.</li>
          <li>Los precios no incluyen ITBIS unless especificado.</li>
          <li>Los tiempos de entrega pueden variar según disponibilidad.</li>
          <li>Se requiere un 50% de anticipo para iniciar el trabajo.</li>
        </ul>
      </section>

      {/* Pie de página */}
      <footer className="text-center text-[10px] text-gray-500 border-t pt-4">
        <p>Gracias por su preferencia.</p>
        <p>Cotización generada por FacturaDO.</p>
      </footer>
    </div>
  )
}
