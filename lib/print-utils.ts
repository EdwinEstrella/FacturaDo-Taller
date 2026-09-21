/**
 * Utilidades para extracción de contenido y estilos completos para impresión y exportación a PDF.
 * Garantiza que Tailwind CSS, estilos de componentes, fuentes e imágenes relativas
 * se incluyan íntegramente en el documento final.
 */

export interface PrintData {
  html: string;
  css: string;
  headTags: string;
  baseUrl: string;
}

export function extractPrintData(
  element: HTMLElement | null,
  fallbackHtml: string = ""
): PrintData {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  let contentHtml = fallbackHtml;

  if (element) {
    try {
      const clone = element.cloneNode(true) as HTMLElement;

      // Inyectar imágenes locales como Data URLs en Base64 para carga instantánea y sin dependencias de red
      const images = Array.from(clone.querySelectorAll("img"));
      for (const img of images) {
        const originalSrc = img.getAttribute("src") || img.src;
        if (!originalSrc) continue;
        if (originalSrc.startsWith("data:")) continue;

        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width || 120;
          canvas.height = img.naturalHeight || img.height || 120;
          const ctx = canvas.getContext("2d");
          if (ctx && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, 0, 0);
            img.src = canvas.toDataURL("image/png");
            continue;
          }
        } catch {
          // Canvas tinto por CORS o imagen externa; pasar a URL absoluta
        }

        try {
          img.src = new URL(originalSrc, baseUrl).href;
        } catch {
          // Mantener src original si falla construcción de URL
        }
      }

      contentHtml = clone.outerHTML;
    } catch (e) {
      console.warn("[print-utils] No se pudo clonar elemento para extracción; usando innerHTML:", e);
      contentHtml = element.innerHTML;
    }
  }

  // Asegurar que rutas relativas de imágenes en el HTML tengan URL absoluta con el origen actual
  if (baseUrl) {
    contentHtml = contentHtml.replace(/src="\/([^"]+)"/g, `src="${baseUrl}/$1"`);
  }

  // Recolectar reglas CSS compiladas desde document.styleSheets (Tailwind v4, utilidades y fuentes)
  let css = "";
  if (typeof document !== "undefined") {
    try {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = sheet.cssRules || sheet.rules;
          if (rules) {
            for (const rule of Array.from(rules)) {
              css += rule.cssText + "\n";
            }
          }
        } catch {
          // Estilo de origen cruzado protegido; se delega en los headTags
        }
      }
    } catch (err) {
      console.warn("[print-utils] Error al leer document.styleSheets:", err);
    }

    // Incluir también contenido de etiquetas <style> directas
    document.querySelectorAll("style").forEach((styleEl) => {
      if (styleEl.textContent) {
        css += styleEl.textContent + "\n";
      }
    });
  }

  // Recolectar etiquetas <link> de hojas de estilo externas
  const headTags: string[] = [];
  if (typeof document !== "undefined") {
    document
      .querySelectorAll("link[rel='stylesheet'], link[rel='preload'][as='style']")
      .forEach((link) => {
        headTags.push(link.outerHTML);
      });
  }

  return {
    html: contentHtml,
    css,
    headTags: headTags.join("\n"),
    baseUrl,
  };
}
