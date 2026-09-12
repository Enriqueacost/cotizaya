import type { IvaMode, QuoteItem } from "./types";

/** Cantidad efectiva: si se deja vacía/0 pero hay precio, se trata como servicio único (1). */
export function qtyOf(it: QuoteItem): number {
  const q = Number(it.cantidad) || 0;
  if (q > 0) return q;
  return Number(it.precio) > 0 ? 1 : 0;
}

export function itemSubtotal(it: QuoteItem): number {
  return qtyOf(it) * (Number(it.precio) || 0);
}

export function qtyLabel(it: QuoteItem): string {
  const q = Number(it.cantidad) || 0;
  return q > 0 ? String(q) : "—";
}

export function calcQuote(
  items: QuoteItem[],
  descuentoTipo: "pct" | "monto",
  descuentoValor: number,
  ivaMode: IvaMode,
) {
  const subtotal = items.reduce((acc, it) => acc + itemSubtotal(it), 0);
  const descRaw = Number(descuentoValor) || 0;
  const descuentoMonto =
    descuentoTipo === "pct"
      ? Math.round((subtotal * Math.min(Math.max(descRaw, 0), 100)) / 100)
      : Math.min(Math.max(descRaw, 0), subtotal);
  const base = subtotal - descuentoMonto;

  let ivaMonto = 0;
  let total = base;
  let ivaRate = 0;

  switch (ivaMode) {
    case "incl10":
      ivaRate = 10;
      ivaMonto = Math.round((base * 10) / 110);
      total = base;
      break;
    case "mas10":
      ivaRate = 10;
      ivaMonto = Math.round(base * 0.1);
      total = base + ivaMonto;
      break;
    case "mas5":
      ivaRate = 5;
      ivaMonto = Math.round(base * 0.05);
      total = base + ivaMonto;
      break;
    case "exenta":
      ivaMonto = 0;
      total = base;
      break;
  }

  return { subtotal, descuentoMonto, base, ivaMonto, total, ivaRate };
}

export function formatGs(value: number): string {
  return (
    "Gs. " +
    new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(
      Math.round(value || 0),
    )
  );
}

export function ivaShortLabel(mode: IvaMode): string {
  switch (mode) {
    case "incl10":
      return "IVA incl.";
    case "mas10":
      return "+IVA 10%";
    case "mas5":
      return "+IVA 5%";
    case "exenta":
      return "Exenta";
  }
}
