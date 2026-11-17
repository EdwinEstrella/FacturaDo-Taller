import type { EcfPrintData } from "@/lib/fiscal/printed/ecf-print-data"

/**
 * DGII stamp printed at the bottom of an electronic invoice: QR, security code and signature date.
 * Plain <img> on purpose: the template is cloned into a print window where next/image does not run.
 */
export function EcfFiscalStamp({ ecf, variant }: { ecf?: EcfPrintData | null; variant: "ticket" | "a4" }) {
    if (!ecf || ecf.state !== "ready") return null

    const qrSize = variant === "ticket" ? 112 : 104

    return (
        <div className={variant === "ticket" ? "my-3 flex flex-col items-center text-center text-xs" : "mt-6 flex items-center gap-4 text-[11px]"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ecf.qrDataUrl} alt="Código QR DGII" width={qrSize} height={qrSize} style={{ width: qrSize, height: qrSize }} />
            <div className={variant === "ticket" ? "mt-1 space-y-0.5" : "space-y-0.5"}>
                <p><strong>Código de seguridad:</strong> {ecf.securityCode}</p>
                {ecf.signedAt && <p><strong>Fecha de firma digital:</strong> {ecf.signedAt}</p>}
                <p><strong>e-NCF:</strong> {ecf.encf}</p>
            </div>
        </div>
    )
}
