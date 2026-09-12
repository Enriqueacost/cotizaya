import type {
  Company,
  HistoryEntry,
  ItemTemplate,
  Quote,
  QuoteItem,
  QuoteStatus,
} from "./types";

const COMPANY_KEY = "cotizaya:company";
const COUNTER_KEY = "cotizaya:counter";
const LAST_QUOTE_KEY = "cotizaya:last-quote";
const DRAFT_KEY = "cotizaya:draft";
const HISTORY_KEY = "cotizaya:history";
const TEMPLATES_KEY = "cotizaya:templates";

export const BRAND_PRESETS = [
  "#059669", // verde
  "#2563eb", // azul
  "#7c3aed", // violeta
  "#ea580c", // naranja
  "#e11d48", // rojo
  "#0f766e", // teal
  "#1f2937", // grafito
];

export interface Draft {
  fechaInput: string;
  clienteNombre: string;
  clienteRuc: string;
  clienteTelefono: string;
  items: QuoteItem[];
  descuentoTipo: "pct" | "monto";
  descuentoValor: number;
  ivaMode: Company["ivaDefault"];
  notas: string;
}

export function getDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!Array.isArray(d.items) || d.items.length === 0) return null;
    return d;
  } catch {
    return null;
  }
}

export function saveDraft(d: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* storage lleno o no disponible: no es crítico */
  }
}

/** Convierte un borrador en Quote para previsualizar sin haberlo "generado". */
export function draftToQuote(d: Draft): Quote {
  return {
    numero: "",
    fecha: d.fechaInput
      ? new Date(d.fechaInput + "T12:00:00").toISOString()
      : new Date().toISOString(),
    clienteNombre: d.clienteNombre,
    clienteRuc: d.clienteRuc,
    clienteTelefono: d.clienteTelefono,
    items: d.items,
    descuentoTipo: d.descuentoTipo,
    descuentoValor: d.descuentoValor,
    ivaMode: d.ivaMode,
    validezDias: 0,
    notas: d.notas,
  };
}

export const defaultCompany: Company = {
  nombre: "",
  descripcion: "",
  ruc: "",
  telefono: "",
  email: "",
  direccion: "",
  logo: "",
  color: "#059669",
  ivaDefault: "incl10",
  validezDias: 15,
  condiciones: "Precios en Guaraníes. Forma de pago a convenir.",
};

export function getCompany(): Company {
  try {
    const raw = localStorage.getItem(COMPANY_KEY);
    if (!raw) return defaultCompany;
    return { ...defaultCompany, ...JSON.parse(raw) };
  } catch {
    return defaultCompany;
  }
}

export function saveCompany(c: Company) {
  localStorage.setItem(COMPANY_KEY, JSON.stringify(c));
}

export function hasCompany(): boolean {
  const c = getCompany();
  return c.nombre.trim().length > 1;
}

function getCounter(): number {
  const raw = localStorage.getItem(COUNTER_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function peekNextNumero(): string {
  return String(getCounter() + 1).padStart(3, "0");
}

export function consumeNextNumero(): string {
  const next = getCounter() + 1;
  localStorage.setItem(COUNTER_KEY, String(next));
  return String(next).padStart(3, "0");
}

export function saveLastQuote(q: Quote) {
  localStorage.setItem(LAST_QUOTE_KEY, JSON.stringify(q));
}

export function getLastQuote(): Quote | null {
  try {
    const raw = localStorage.getItem(LAST_QUOTE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Quote;
  } catch {
    return null;
  }
}

export function fileToDataURL(file: File, maxSize = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(reader.result as string);
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- Historial ----------
export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persistHistory(list: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Reemplaza el historial local (usado por la sincronización con la nube). */
export function setHistory(list: HistoryEntry[]) {
  persistHistory(Array.isArray(list) ? list : []);
}

/** Guarda un presupuesto generado en el historial con folio interno. */
export function addHistoryEntry(
  quote: Quote,
  total: number,
): HistoryEntry {
  const entry: HistoryEntry = {
    id: Math.random().toString(36).slice(2, 10),
    folio: consumeNextNumero(),
    fecha: quote.fecha,
    clienteNombre: quote.clienteNombre || "—",
    total,
    status: "borrador",
    quote,
  };
  persistHistory([entry, ...getHistory()]);
  return entry;
}

export function updateHistoryStatus(id: string, status: QuoteStatus) {
  persistHistory(
    getHistory().map((e) => (e.id === id ? { ...e, status } : e)),
  );
}

export function deleteHistoryEntry(id: string) {
  persistHistory(getHistory().filter((e) => e.id !== id));
}

// ---------- Ítems frecuentes (plantillas) ----------
export function getTemplates(): ItemTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as ItemTemplate[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveTemplate(t: Omit<ItemTemplate, "id">): ItemTemplate[] {
  const entry: ItemTemplate = {
    ...t,
    id: Math.random().toString(36).slice(2, 10),
  };
  const list = [entry, ...getTemplates()].slice(0, 30);
  setTemplates(list);
  return list;
}

/** Reemplaza las plantillas locales (usado por la sincronización con la nube). */
export function setTemplates(list: ItemTemplate[]) {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function deleteTemplate(id: string): ItemTemplate[] {
  const list = getTemplates().filter((t) => t.id !== id);
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}
