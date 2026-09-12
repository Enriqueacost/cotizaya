export type IvaMode = "incl10" | "mas10" | "mas5" | "exenta";

export interface Company {
  nombre: string;
  descripcion: string;
  ruc: string;
  telefono: string;
  email: string;
  direccion: string;
  logo: string; // dataURL base64
  color: string; // color de marca en hex, ej. #059669
  ivaDefault: IvaMode;
  validezDias: number;
  condiciones: string;
}

export interface QuoteItem {
  id: string;
  descripcion: string;
  cantidad: number;
  precio: number;
}

export interface Quote {
  numero: string;
  fecha: string; // ISO
  clienteNombre: string;
  clienteRuc: string;
  clienteTelefono: string;
  items: QuoteItem[];
  descuentoTipo: "pct" | "monto";
  descuentoValor: number;
  ivaMode: IvaMode;
  validezDias: number;
  notas: string;
}

export const IVA_LABELS: Record<IvaMode, string> = {
  incl10: "IVA 10% incluido",
  mas10: "IVA 10% adicional",
  mas5: "IVA 5% adicional",
  exenta: "Exenta",
};

export type QuoteStatus = "borrador" | "enviado" | "aprobado";

export const STATUS_LABELS: Record<QuoteStatus, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  aprobado: "Aprobado",
};

export interface HistoryEntry {
  id: string;
  folio: string; // numeración interna, solo visible en historial
  fecha: string; // ISO
  clienteNombre: string;
  total: number;
  status: QuoteStatus;
  quote: Quote;
}

export interface ItemTemplate {
  id: string;
  descripcion: string;
  cantidad: number;
  precio: number;
}
