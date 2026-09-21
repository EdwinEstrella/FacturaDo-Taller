"use client";

import { useState } from "react";
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

interface ExportPdfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  defaultFilename: string;
  initialFormat?: "ticket" | "a4";
  getHtmlContent: () => string;
}

export function ExportPdfModal({
  open,
  onOpenChange,
  title = "Guardar como PDF",
  defaultFilename,
  initialFormat = "a4",
  getHtmlContent,
}: ExportPdfModalProps) {
  const [filename, setFilename] = useState(defaultFilename);
  const [format, setFormat] = useState<"ticket" | "a4">(initialFormat);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const html = getHtmlContent();
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
        // Fallback para navegador web sin Electron
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>${cleanName}</title>
                <style>
                  @page { size: ${format === "ticket" ? "80mm auto" : "A4"}; margin: 10mm; }
                  body { font-family: sans-serif; margin: 0; padding: 10px; }
                </style>
              </head>
              <body>
                ${html}
                <script>
                  window.onload = function() {
                    window.print();
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
                Genera un documento PDF digital listo para compartir o archivar.
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
              onChange={(e) => setFormat(e.target.value as "ticket" | "a4")}
              className="w-full flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="a4">Factura / Cotización A4 (Recomendado para enviar)</option>
              <option value="ticket">Ticket 80mm (Formato de rollo térmico)</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              En la versión de escritorio, el archivo se guardará automáticamente en tu carpeta de Descargas y se resaltará al completarse.
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
