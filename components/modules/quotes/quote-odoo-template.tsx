import { format } from "date-fns"
import { es } from "date-fns/locale"
import { formatCurrency, formatQuantity } from "@/lib/utils"
import { normalizeStorageObjectUrl } from "@/lib/insforge/storage-url"

interface QuoteOdooTemplateProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quote: any
  settings?: {
    companyName: string
    companyRnc: string
    companyPhone: string
    companyAddress: string
    companyLogo?: string
  }
}

export function QuoteOdooTemplate({ quote, settings }: QuoteOdooTemplateProps) {
  const companyName = settings?.companyName || "FacturaDO"
  const companyRnc = settings?.companyRnc || "101-00000-0"
  const companyAddress = settings?.companyAddress || "Av. Winston Churchill #101"
  const companyPhone = settings?.companyPhone || "809-555-0101"
  const logoSrc = normalizeStorageObjectUrl(settings?.companyLogo) || "/logo.png"
  const issueDate = new Date(quote.createdAt)

  const subtotal = quote.items.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (acc: number, item: any) => acc + Number(item.price) * item.quantity,
    0
  )
  const tax = Number(quote.tax ?? 0)
  const shipping = Number(quote.shippingCost ?? 0)
  const total = Number(quote.total ?? subtotal + tax + shipping)
  const documentNumber = quote.sequenceNumber
    ? `#${String(quote.sequenceNumber).padStart(6, "0")}`
    : `#${String(quote.id ?? "").slice(-8).toUpperCase()}`
  const clientName = quote.client?.name || quote.clientName || "Cliente"
  const clientIdentifier = quote.client?.rnc || quote.client?.cedula
  const clientAddress = quote.client?.address
  const clientPhone = quote.client?.phone
  const statusLabel = quote.isDraft
    ? "Borrador"
    : quote.status === "ACCEPTED"
      ? "Aceptada"
      : quote.status === "REJECTED"
        ? "Rechazada"
        : quote.status === "EXPIRED"
          ? "Vencida"
          : "Pendiente"

  return (
    <div className="print-container-wrapper mx-auto min-h-[297mm] w-[210mm] bg-[#f2f3f5] p-[10mm] font-sans text-[#121820]">
      <style>{`
        @media print {
          @page { 
            margin: 8mm; 
            size: A4 portrait; 
          }
          html, body { 
            background: white !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-container-wrapper {
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: auto !important;
          }
          .quote-page { 
            box-shadow: none !important; 
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: auto !important;
          }
        }
      `}</style>

      <div className="quote-page min-h-[277mm] bg-white px-[12mm] py-[11mm] shadow-[0_10px_25px_rgba(15,23,42,0.22)]">
        <header className="mb-4">
          <div className="flex items-start justify-between gap-8">
            <div className="flex max-w-[105mm] items-start gap-3">
              <div className="flex h-[21mm] w-[21mm] shrink-0 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc} alt="Logo" className="max-h-full max-w-full object-contain" />
              </div>
              <div className="pt-1">
                <h1 className="text-[22px] font-black uppercase leading-none tracking-tight text-[#18212b]">
                  {companyName}
                </h1>
                <p className="mt-1 text-[10px] leading-[13px] text-black">
                  {companyAddress}
                  <br />
                  {companyPhone && <>Tel: {companyPhone}</>}
                  {companyRnc && (
                    <>
                      <br />
                      RNC: {companyRnc}
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="pt-3 text-right">
              <h2 className="text-[42px] font-black uppercase leading-none tracking-tight text-[#315f8a]">
                COTIZACIÓN
              </h2>
            </div>
          </div>

          <div className="mt-4 h-[3px] w-full bg-[#5a9bc0]" />
        </header>

        <section className="mb-4 grid grid-cols-2 gap-10 text-[12px] leading-[16px]">
          <div>
            <h3 className="mb-1 text-[14px] font-black uppercase">Cotizado a:</h3>
            <p>
              <span className="font-black">Cliente:</span> {clientName}
            </p>
            {clientIdentifier && (
              <p>
                <span className="font-black">RNC/Cédula:</span> {clientIdentifier}
              </p>
            )}
            {clientAddress && <p>{clientAddress}</p>}
            {clientPhone && <p>{clientPhone}</p>}
          </div>

          <div>
            <h3 className="mb-1 text-[14px] font-black uppercase">Detalles de cotización</h3>
            <p>
              <span className="font-black">Cotización #:</span> {documentNumber}
            </p>
            <p>
              <span className="font-black">Fecha:</span>{" "}
              {format(issueDate, "dd MMMM yyyy", { locale: es })}
            </p>
            {quote.validUntil && (
              <p>
                <span className="font-black">Válida hasta:</span>{" "}
                {format(new Date(quote.validUntil), "dd MMMM yyyy", { locale: es })}
              </p>
            )}
            <p>
              <span className="font-black">Estado:</span> {statusLabel}
            </p>
            <p>
              <span className="font-black">Documento:</span> No fiscal
            </p>
          </div>
        </section>

        <section className="mb-3">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#2f6f9f] text-white">
                <th className="w-[10mm] border border-[#9fb0bd] px-2 py-[7px] text-left font-bold">Sr.</th>
                <th className="border border-[#9fb0bd] px-2 py-[7px] text-left font-bold">Descripción</th>
                <th className="w-[26mm] border border-[#9fb0bd] px-2 py-[7px] text-center font-bold">Cantidad</th>
                <th className="w-[30mm] border border-[#9fb0bd] px-2 py-[7px] text-right font-bold">Precio</th>
                <th className="w-[32mm] border border-[#9fb0bd] px-2 py-[7px] text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {quote.items.map((item: any, index: number) => (
                <tr key={item.id} className="odd:bg-[#f7f7f7] even:bg-white">
                  <td className="border border-[#c8cfd5] px-2 py-[9px] text-center align-top">{index + 1}.</td>
                  <td className="border border-[#c8cfd5] px-2 py-[9px] align-top font-semibold">{item.productName}</td>
                  <td className="border border-[#c8cfd5] px-2 py-[9px] text-center align-top">{formatQuantity(item.quantity)}</td>
                  <td className="border border-[#c8cfd5] px-2 py-[9px] text-right align-top">{formatCurrency(Number(item.price))}</td>
                  <td className="border border-[#c8cfd5] px-2 py-[9px] text-right align-top">{formatCurrency(Number(item.price) * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mb-7 flex justify-end">
          <div className="w-[72mm] text-[12px]">
            <div className="flex justify-between py-[5px]">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {(quote.applyTax || tax > 0) && (
              <div className="flex justify-between py-[5px]">
                <span>ITBIS</span>
                <span>{formatCurrency(tax)}</span>
              </div>
            )}
            {shipping > 0 && (
              <div className="flex justify-between py-[5px]">
                <span>Envío</span>
                <span>{formatCurrency(shipping)}</span>
              </div>
            )}
            <div className="mt-1 border-t-2 border-[#5a9bc0] pt-[7px]">
              <div className="flex justify-between text-[15px] font-black text-[#315f8a]">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-12 text-[12px] leading-[16px]">
          <div>
            <h3 className="mb-2 text-[14px] font-black uppercase">Contacto</h3>
            <p>
              <span className="font-black">{companyName}</span>
              <br />
              Tel: {companyPhone}
              {companyRnc && <><br />RNC: {companyRnc}</>}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-[14px] font-black uppercase">Notas:</h3>
            <p>
              {quote.notes || "Cotización informativa. No consume NCF ni registra movimientos contables hasta convertirse en factura."}
            </p>
            <p className="mt-2 font-semibold">
              {quote.applyTax || tax > 0
                ? "Los importes reflejan ITBIS cuando aplica."
                : "Los importes no incluyen ITBIS."}
            </p>
          </div>
        </section>

        <footer className="mt-8 border-t border-[#5a9bc0] pt-3 text-[11px]">
          <div className="flex items-center justify-between gap-4">
            <p className="font-semibold">{companyName}</p>
            <p className="text-right">
              {companyPhone}
              {companyAddress && ` | ${companyAddress}`}
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
