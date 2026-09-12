import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

/**
 * PDF idéntico a la vista previa: captura la hoja tal como se ve en la app
 * en alta resolución y la vuelca en A4, con descarga directa sin pasar por
 * el diálogo de impresión.
 *
 * Dos decisiones anti-artefactos (franja negra en visores de celular):
 * 1) Se pagina por RECORTES: cada página lleva su propio PNG recortado del
 *    bitmap original. Nada de repetir la imagen entera con desplazamiento
 *    negativo (algunos visores móviles no recortan bien el contenido
 *    fuera de página y lo muestran como banda negra en el corte).
 * 2) Cada recorte se pega sobre fondo blanco (nada de alfa → negro).
 */
async function renderSheet(element: HTMLElement): Promise<HTMLImageElement> {
  const dataUrl = await toPng(element, {
    pixelRatio: 3,
    cacheBust: true,
    backgroundColor: "#ffffff",
    style: { margin: "0" },
  });
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("no se pudo decodificar la captura"));
    img.src = dataUrl;
  });
  return img;
}

function paginateToPdf(img: HTMLImageElement): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 8;
  const renderW = pageW - margin * 2;
  const pageContentH = pageH - margin * 2;
  const renderH = (img.height * renderW) / img.width;

  if (renderH <= pageContentH) {
    pdf.addImage(img.src, "PNG", margin, margin, renderW, renderH);
    return pdf;
  }

  // px del bitmap por cada mm de página (mismo en ambos ejes: sin deformar)
  const pxPerMm = img.width / renderW;
  const sliceHpx = Math.max(1, Math.round(pageContentH * pxPerMm));

  let y = 0;
  let page = 0;
  while (y < img.height) {
    const h = Math.min(sliceHpx, img.height - y);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas no disponible");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Copia 1:1 (mismo tamaño origen/destino: sin reescalado ni blur)
    ctx.drawImage(img, 0, y, img.width, h, 0, 0, img.width, h);
    const sliceHmm = (h * renderW) / img.width;
    if (page > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, renderW, sliceHmm);
    y += h;
    page++;
  }
  return pdf;
}

async function buildPdf(element: HTMLElement): Promise<jsPDF> {
  const img = await renderSheet(element);
  return paginateToPdf(img);
}

/** Descarga directa del PDF idéntico a la vista previa. */
export async function downloadPreviewPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const pdf = await buildPdf(element);
  pdf.save(filename);
}

/** Blob del PDF para compartir (WhatsApp, etc.). */
export async function getPreviewPdfBlob(element: HTMLElement): Promise<Blob> {
  const pdf = await buildPdf(element);
  return pdf.output("blob");
}

export function getPdfFilename(fechaISO: string): string {
  return `CotizaYa-${fechaISO.slice(0, 10)}.pdf`;
}
