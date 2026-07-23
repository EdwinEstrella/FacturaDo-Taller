import { format } from "date-fns"
import { es } from "date-fns/locale"
import { formatCurrency, formatQuantity } from "@/lib/utils"
import { calculateDerivedInvoiceDiscount } from "@/lib/invoice-totals"
import { normalizeStorageObjectUrl } from "@/lib/insforge/storage-url"

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
  const logoSrc = normalizeStorageObjectUrl(settings?.companyLogo) || "/logo.png"
  const issueDate = new Date(invoice.createdAt)

  const subtotal = invoice.items.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (acc: number, item: any) => acc + Number(item.price) * item.quantity,
    0
  )
  const tax = Number(invoice.tax ?? 0)
  const shipping = Number(invoice.shippingCost ?? 0)
  const discount = calculateDerivedInvoiceDiscount(invoice)
  const total = Number(invoice.total ?? subtotal + tax + shipping - discount)
  const balance = Number(invoice.balance ?? 0)
  const isPending = invoice.status === "PENDING" || balance > 0
  const documentNumber = `#${String(invoice.sequenceNumber ?? "").padStart(6, "0")}`
  const clientName = invoice.clientName || invoice.client?.name || "Consumidor Final"
  const clientIdentifier = invoice.client?.rnc || invoice.clientRnc || invoice.client?.cedula
  const clientAddress = invoice.client?.address
  const clientPhone = invoice.client?.phone

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
          .invoice-page { 
            box-shadow: none !important; 
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: auto !important;
          }
        }
      `}</style>

      <div className="invoice-page min-h-[277mm] bg-white px-[12mm] py-[11mm] shadow-[0_10px_25px_rgba(15,23,42,0.22)] relative overflow-hidden">
        {invoice.status === 'PAID' && (
          <div className="absolute top-[40%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 -rotate-[35deg] pointer-events-none z-0" style={{ opacity: 0.12 }}>
            <div className="text-[120px] font-black text-emerald-600 border-[12px] border-emerald-600 px-12 py-4 rounded-3xl whitespace-nowrap uppercase tracking-[0.2em] shadow-sm">
              Pagado
            </div>
          </div>
        )}

        <header className="mb-4 relative z-10">
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
                FACTURA
              </h2>
            </div>
          </div>

          <div className="mt-4 h-[3px] w-full bg-[#5a9bc0]" />
        </header>

        <section className="mb-4 grid grid-cols-2 gap-10 text-[12px] leading-[16px]">
          <div>
            <h3 className="mb-1 text-[14px] font-black uppercase">Factura a:</h3>
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
            <h3 className="mb-1 text-[14px] font-black uppercase">Detalles de factura</h3>
            <p>
              <span className="font-black">Factura:</span> {documentNumber}
            </p>
            <p>
              <span className="font-black">Fecha:</span>{" "}
              {format(issueDate, "dd MMMM yyyy", { locale: es })}
            </p>
            {invoice.deliveryDate && (
              <p>
                <span className="font-black">Entrega:</span>{" "}
                {format(new Date(invoice.deliveryDate), "dd MMMM yyyy", { locale: es })}
              </p>
            )}
            <p>
              <span className="font-black">Términos:</span> {isPending ? "Crédito" : "Contado"}
            </p>
            {invoice.ncf && (
              <p>
                <span className="font-black">NCF:</span> {invoice.ncf}
              </p>
            )}
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
              {invoice.items.map((item: any, index: number) => (
                <tr key={item.id} className="odd:bg-[#f7f7f7] even:bg-white">
                  <td className="border border-[#c8cfd5] px-2 py-[9px] text-center align-top">{index + 1}.</td>
                  <td className="border border-[#c8cfd5] px-2 py-[9px] align-top font-semibold">
                    {item.productName}
                    {item.description && <div className="mt-1 text-[10px] font-normal">{item.description}</div>}
                  </td>
                  <td className="border border-[#c8cfd5] px-2 py-[9px] text-center align-top">{formatQuantity(item.quantity)}</td>
                  <td className="border border-[#c8cfd5] px-2 py-[9px] text-right align-top">
                    {formatCurrency(Number(item.price))}
                  </td>
                  <td className="border border-[#c8cfd5] px-2 py-[9px] text-right align-top">
                    {formatCurrency(Number(item.price) * item.quantity)}
                  </td>
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
            <div className="flex justify-between py-[5px]">
              <span>ITBIS</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between py-[5px]">
                <span>Discount</span>
                <span>-{formatCurrency(discount)}</span>
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
            {isPending && (
              <div className="mt-2 flex justify-between text-[12px] font-black">
                <span>Pendiente</span>
                <span>{formatCurrency(balance)}</span>
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-12 text-[12px] leading-[16px]">
          <div>
            <h3 className="mb-2 text-[14px] font-black uppercase">Métodos de pago</h3>
            <p>
              <span className="font-black">Efectivo / Transferencia</span>
              <br />
              Cliente: {companyName}
              <br />
              Tel: {companyPhone}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-[14px] font-black uppercase">Notas:</h3>
            <p className="whitespace-pre-line">
              {invoice.notes ||
                "Gracias por su compra. Favor realizar el pago antes de la fecha acordada e incluir el número de factura como referencia."}
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
