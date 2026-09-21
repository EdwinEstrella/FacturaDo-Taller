"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, Download, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { extractPrintData } from "@/lib/print-utils";

interface ExportPdfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  defaultFilename: string;
  initialFormat?: "ticket" | "a4";
  onFormatChange?: (format: "ticket" | "a4") => void;
  getContentElement?: () => HTMLElement | null;
  getHtmlContent?: () => string;
}

export function ExportPdfModal({
  open,
  onOpenChange,
  title = "Guardar como PDF",
  defaultFilename,
  initialFormat = "a4",
  onFormatChange,
  getContentElement,
  getHtmlContent,
}: ExportPdfModalProps) {
  const [filename, setFilename] = useState(defaultFilename);
  const [format, setFormat] = useState<"ticket" | "a4">(initialFormat);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFilename(defaultFilename);
      setFormat(initialFormat);
    }
  }, [open, defaultFilename, initialFormat]);

  const handleFormatSelect = (newFormat: "ticket" | "a4") => {
    setFormat(newFormat);
    onFormatChange?.(newFormat);
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const element = getContentElement ? getContentElement() : null;
      const fallbackHtml = getHtmlContent ? getHtmlContent() : "";

      const { html, css, headTags, baseUrl } = extractPrintData(element, fallbackHtml);

      if (!html || html.trim().length === 0) {
        toast.error("No se encontró contenido para exportar");
        setLoading(false);
        return;
      }

      const cleanName = filename.trim().endsWith(".pdf")
        ? filename.trim()
        : `${filename.trim()}.pdf`;

      if (typeof window !== "undefined" && window.electron?.exportToPdf) {
        const res = await window.electron.exportToPdf({
          html,
          format,
          filename: cleanName,
          css,
          headTags,
          baseUrl,
        });

        if (res.success) {
          toast.success("PDF guardado correctamente en Descargas", {
            description: res.filePath || cleanName,
            icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
          });
          onOpenChange(false);
        } else {
          toast.error("Error al generar el PDF", {
            description: res.error || "Intente nuevamente",
          });
        }
      } else {
        // Fallback completo con estilos para navegador web sin Electron
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          const isThermal = format === "ticket";
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <title>${cleanName}</title>
                <base href="${baseUrl}/">
                ${headTags}
                <style>
                  @page {
                    margin: ${isThermal ? "0mm" : "8mm"};
                    ${isThermal ? "size: 80mm auto;" : "size: A4 portrait;"}
                  }
                  *, *::before, *::after { box-sizing: border-box; }
                  html, body {
                    margin: 0;
                    padding: 0;
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    background: white !important;
                    color: #111827 !important;
                  }
                  ${isThermal ? `
                  body {
                    width: 80mm;
                    padding: 2mm;
                  }
                  ` : `
                  .print-container-wrapper {
                    background: transparent !important;
                    padding: 0 !important;
                    margin: 0 auto !important;
                    width: 100% !important;
                    min-height: auto !important;
                  }
                  .invoice-page, .quote-page {
                    box-shadow: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    width: 100% !important;
                    min-height: auto !important;
                  }
                  `}
                  ${css}
                </style>
              </head>
              <body>
                ${html}
                <script>
                  window.onload = function() {
                    setTimeout(() => {
                      window.print();
                    }, 300);
                  };
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
          toast.info("Usa la opción 'Guardar como PDF' en la ventana de impresión.");
          onOpenChange(false);
        } else {
          toast.error("El navegador bloqueó la ventana emergente.");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Ocurrió un error al exportar", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base">{title}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Genera un documento PDF digital con diseño y formatos completos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pdf-filename" className="text-xs font-semibold">
              Nombre del archivo
            </Label>
            <Input
              id="pdf-filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Ej: Factura-0001.pdf"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pdf-format" className="text-xs font-semibold">
              Formato de hoja
            </Label>
            <select
              id="pdf-format"
              value={format}
              onChange={(e) => handleFormatSelect(e.target.value as "ticket" | "a4")}
              className="w-full flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="a4">Factura / Cotización A4 (Recomendado para enviar)</option>
              <option value="ticket">Ticket 80mm (Formato de rollo térmico)</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              En la versión de escritorio, el archivo se guardará automáticamente en tu carpeta de Descargas con todos los estilos aplicados.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleExport}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generando PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Guardar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
