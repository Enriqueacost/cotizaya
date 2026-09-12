import { calcQuote, formatGs, qtyLabel } from "./quote-math";
import type { Company, Quote } from "./types";

export function buildWhatsAppMessage(company: Company, quote: Quote): string {
  const calc = calcQuote(
    quote.items,
    quote.descuentoTipo,
    quote.descuentoValor,
    quote.ivaMode,
  );
  const fecha = new Date(quote.fecha).toLocaleDateString("es-PY");
  const lines = [
    `*${company.nombre || "Mi Empresa"}*`,
    `🧾 *Presupuesto* — ${fecha}`,
    "",
  ];
  if (quote.clienteNombre) lines.push(`👤 Cliente: ${quote.clienteNombre}`);
  lines.push("");
  quote.items.forEach((it, i) => {
    const q = qtyLabel(it);
    const qty = q === "—" ? "" : `${q} × `;
    lines.push(
      `${i + 1}. ${it.descripcion || "-"} — ${qty}${formatGs(Number(it.precio) || 0)}`,
    );
  });
  lines.push("");
  if (calc.descuentoMonto > 0)
    lines.push(`Descuento: -${formatGs(calc.descuentoMonto)}`);
  lines.push(`*TOTAL: ${formatGs(calc.total)}*`);
  if (quote.notas) lines.push(`\n📝 ${quote.notas}`);
  if (company.telefono) lines.push(`\n📞 ${company.telefono}`);
  return lines.join("\n");
}

/** ¿El dispositivo puede compartir archivos (ideal en mobile)? */
export function canShareFiles(file: File): boolean {
  try {
    return (
      typeof navigator !== "undefined" &&
      "share" in navigator &&
      "canShare" in navigator &&
      navigator.canShare({ files: [file] })
    );
  } catch {
    return false;
  }
}

/**
 * Envía por WhatsApp:
 * 1. Si el mobile soporta compartir archivos → hoja nativa (elegís el
 *    contacto ahí mismo y va el PDF adjunto + resumen).
 * 2. Si no → abre WhatsApp con el resumen (ahí elegís el contacto).
 */
export async function sendViaWhatsApp(
  company: Company,
  quote: Quote,
  pdfFile: File | null,
): Promise<void> {
  const message = buildWhatsAppMessage(company, quote);

  if (pdfFile && canShareFiles(pdfFile)) {
    try {
      await navigator.share({
        files: [pdfFile],
        title: "Presupuesto",
        text: message,
      });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      // Otro error: caer al wa.me
    }
  }

  window.open(
    `https://wa.me/?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener",
  );
}
