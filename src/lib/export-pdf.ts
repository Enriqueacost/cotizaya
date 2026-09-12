import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

/**
 * PDF idéntico a la vista previa: captura la hoja tal como se ve en la app
 * (html-to-image renderiza con el motor del navegador, soporta oklch de
 * Tailwind v4) en alta resolución y la vuelca en un A4, con descarga directa
 * sin pasar por el diálogo de impresión.
 */
async function renderSheet(element: HTMLElement): Promise<string> {
  return toPng(element, {
    pixelRatio: 3,
    cacheBust: true,
    backgroundColor: "#ffffff",
    style: { margin: "0" },
  });
}

function paginateToPdf(imgData: string, imgWpx: number, imgHpx: number): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 8;
  const renderW = pageW - margin * 2;
  const renderH = (imgHpx * renderW) / imgWpx;
  const pageContentH = pageH - margin * 2;

  if (renderH <= pageContentH) {
    pdf.addImage(imgData, "PNG", margin, margin, renderW, renderH);
    return pdf;
  }

  // Contenido largo: se repite la imagen con desplazamiento por página
  let rendered = 0;
  let first = true;
  while (rendered < renderH) {
    if (!first) pdf.addPage();
    first = false;
    pdf.addImage(imgData, "PNG", margin, margin - rendered, renderW, renderH);
    rendered += pageContentH;
  }
  return pdf;
}

async function buildPdf(element: HTMLElement): Promise<jsPDF> {
  const imgData = await renderSheet(element);
  const dims = await new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.src = imgData;
  });
  return paginateToPdf(imgData, dims.w, dims.h);
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
