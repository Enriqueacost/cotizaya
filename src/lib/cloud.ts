import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultCompany,
  getCompany,
  getHistory,
  getTemplates,
  saveCompany,
  setHistory,
  setTemplates,
} from "./storage";
import { getSupabase } from "./supabase";
import type {
  Company,
  HistoryEntry,
  ItemTemplate,
  Quote,
  QuoteStatus,
} from "./types";

/** Sesión de nube activa (configurada + usuario logueado). null = modo local. */
export interface CloudCtx {
  sb: SupabaseClient;
  userId: string;
}

export async function cloudSession(): Promise<CloudCtx | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    const userId = data.session?.user.id;
    return userId ? { sb, userId } : null;
  } catch {
    return null;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** true si el id viene de la nube (uuid). Los locales pendientes son strings cortos. */
export const isCloudId = (id: string) => UUID_RE.test(id);

const IMPORTED_KEY = "cotizaya:imported";
export const wasImported = () => {
  try {
    return localStorage.getItem(IMPORTED_KEY) === "1";
  } catch {
    return true; // si no hay storage, no intentar importar
  }
};
export const markImported = () => {
  try {
    localStorage.setItem(IMPORTED_KEY, "1");
  } catch {
    /* ignore */
  }
};

// ---------- Empresa ----------

interface CompanyRow {
  nombre: string;
  descripcion: string;
  ruc: string;
  telefono: string;
  email: string;
  direccion: string;
  logo_url: string;
  color: string;
  iva_default: string;
  validez_dias: number;
  condiciones: string;
}

function rowToCompany(row: CompanyRow): Company {
  return {
    ...defaultCompany,
    nombre: row.nombre ?? "",
    descripcion: row.descripcion ?? "",
    ruc: row.ruc ?? "",
    telefono: row.telefono ?? "",
    email: row.email ?? "",
    direccion: row.direccion ?? "",
    logo: row.logo_url ?? "",
    color: row.color || defaultCompany.color,
    ivaDefault: (row.iva_default as Company["ivaDefault"]) || "incl10",
    validezDias: Number(row.validez_dias) || 0,
    condiciones: row.condiciones ?? "",
  };
}

function dataURLtoBlob(dataUrl: string): Blob | null {
  try {
    const [head, b64] = dataUrl.split(",");
    const mime = head.match(/data:(.*);base64/)?.[1] || "image/png";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

/** Sube un logo (dataURL) al bucket y devuelve su URL pública. */
async function uploadLogo(
  ctx: CloudCtx,
  dataUrl: string,
): Promise<string | null> {
  const blob = dataURLtoBlob(dataUrl);
  if (!blob) return null;
  const path = `${ctx.userId}/logo.png`;
  const { error } = await ctx.sb.storage
    .from("logos")
    .upload(path, blob, { upsert: true, contentType: blob.type || "image/png" });
  if (error) return null;
  const { data } = ctx.sb.storage.from("logos").getPublicUrl(path);
  // Cache-buster para que el header muestre el nuevo logo sin recargar duro
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function fetchCompanyCloud(
  ctx: CloudCtx,
): Promise<Company | null> {
  const { data, error } = await ctx.sb
    .from("companies")
    .select("*")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToCompany(data as CompanyRow);
}

/** Guarda la empresa en la nube (sube el logo si es dataURL). Devuelve la normalizada. */
export async function saveCompanyCloud(
  ctx: CloudCtx,
  c: Company,
): Promise<Company> {
  let logoUrl = c.logo;
  if (c.logo.startsWith("data:")) {
    logoUrl = (await uploadLogo(ctx, c.logo)) ?? c.logo;
  }
  const row = {
    user_id: ctx.userId,
    nombre: c.nombre,
    descripcion: c.descripcion,
    ruc: c.ruc,
    telefono: c.telefono,
    email: c.email,
    direccion: c.direccion,
    logo_url: logoUrl.startsWith("http") ? logoUrl.split("?")[0] : "",
    color: c.color,
    iva_default: c.ivaDefault,
    validez_dias: c.validezDias,
    condiciones: c.condiciones,
  };
  const { error } = await ctx.sb
    .from("companies")
    .upsert(row, { onConflict: "user_id" });
  if (error) throw error;
  return { ...c, logo: logoUrl };
}

// ---------- Presupuestos / historial ----------

interface QuoteRow {
  id: string;
  folio: number;
  fecha: string;
  cliente_nombre: string;
  cliente_ruc: string;
  cliente_telefono: string;
  items: Quote["items"];
  descuento_tipo: string;
  descuento_valor: number;
  iva_mode: string;
  validez_dias: number;
  notas: string;
  total: number;
  status: string;
}

const VALID_STATUS: QuoteStatus[] = ["borrador", "enviado", "aprobado"];

function rowToEntry(row: QuoteRow): HistoryEntry {
  const status = VALID_STATUS.includes(row.status as QuoteStatus)
    ? (row.status as QuoteStatus)
    : "borrador";
  return {
    id: row.id,
    folio: String(row.folio).padStart(3, "0"),
    fecha: row.fecha,
    clienteNombre: row.cliente_nombre || "—",
    total: Number(row.total) || 0,
    status,
    quote: {
      numero: "",
      fecha: row.fecha,
      clienteNombre: row.cliente_nombre || "",
      clienteRuc: row.cliente_ruc || "",
      clienteTelefono: row.cliente_telefono || "",
      items: Array.isArray(row.items) ? row.items : [],
      descuentoTipo: row.descuento_tipo === "monto" ? "monto" : "pct",
      descuentoValor: Number(row.descuento_valor) || 0,
      ivaMode: (row.iva_mode as Quote["ivaMode"]) || "incl10",
      validezDias: Number(row.validez_dias) || 0,
      notas: row.notas || "",
    },
  };
}

export async function fetchQuotesCloud(
  ctx: CloudCtx,
): Promise<HistoryEntry[]> {
  const { data, error } = await ctx.sb
    .from("quotes")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as QuoteRow[]).map(rowToEntry);
}

/** Inserta un presupuesto con folio transaccional del servidor. */
export async function insertQuoteCloud(
  ctx: CloudCtx,
  quote: Quote,
  total: number,
  status: QuoteStatus = "borrador",
): Promise<HistoryEntry> {
  const { data: folio, error: folioErr } = await ctx.sb.rpc("next_folio");
  if (folioErr) throw folioErr;
  const { data, error } = await ctx.sb
    .from("quotes")
    .insert({
      user_id: ctx.userId,
      folio: folio as number,
      fecha: quote.fecha,
      cliente_nombre: quote.clienteNombre,
      cliente_ruc: quote.clienteRuc,
      cliente_telefono: quote.clienteTelefono,
      items: quote.items,
      descuento_tipo: quote.descuentoTipo,
      descuento_valor: quote.descuentoValor,
      iva_mode: quote.ivaMode,
      validez_dias: quote.validezDias,
      notas: quote.notas,
      total,
      status,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToEntry(data as QuoteRow);
}

export async function updateQuoteStatusCloud(
  ctx: CloudCtx,
  id: string,
  status: QuoteStatus,
): Promise<void> {
  const { error } = await ctx.sb
    .from("quotes")
    .update({ status })
    .eq("id", id)
    .eq("user_id", ctx.userId);
  if (error) throw error;
}

export async function deleteQuoteCloud(
  ctx: CloudCtx,
  id: string,
): Promise<void> {
  const { error } = await ctx.sb
    .from("quotes")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.userId);
  if (error) throw error;
}

// ---------- Ítems frecuentes ----------

interface TemplateRow {
  id: string;
  descripcion: string;
  cantidad: number;
  precio: number;
}

export async function fetchTemplatesCloud(
  ctx: CloudCtx,
): Promise<ItemTemplate[]> {
  const { data, error } = await ctx.sb
    .from("item_templates")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as TemplateRow[]).map((r) => ({
    id: r.id,
    descripcion: r.descripcion,
    cantidad: Number(r.cantidad) || 0,
    precio: Number(r.precio) || 0,
  }));
}

export async function insertTemplateCloud(
  ctx: CloudCtx,
  t: Omit<ItemTemplate, "id">,
): Promise<ItemTemplate> {
  const { data, error } = await ctx.sb
    .from("item_templates")
    .insert({
      user_id: ctx.userId,
      descripcion: t.descripcion,
      cantidad: t.cantidad,
      precio: t.precio,
    })
    .select()
    .single();
  if (error) throw error;
  const r = data as TemplateRow;
  return {
    id: r.id,
    descripcion: r.descripcion,
    cantidad: Number(r.cantidad) || 0,
    precio: Number(r.precio) || 0,
  };
}

export async function deleteTemplateCloud(
  ctx: CloudCtx,
  id: string,
): Promise<void> {
  const { error } = await ctx.sb
    .from("item_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.userId);
  if (error) throw error;
}

// ---------- Sincronización ----------

/**
 * Baja la nube al caché local.
 * - Empresa/plantillas: la nube pisa lo local solo si trae datos reales
 *   (así no se borra lo trabajado offline si la nube está vacía).
 * - Historial: primero sube los pendientes locales (ids no-uuid) y después
 *   reemplaza el caché con la nube (folios autoritativos del servidor).
 */
export async function pullAll(ctx: CloudCtx): Promise<void> {
  // 1) Subir pendientes creados sin sesión (ids locales, no uuid)
  const pending = getHistory().filter((en) => !isCloudId(en.id));
  for (const p of pending) {
    try {
      await insertQuoteCloud(ctx, p.quote, p.total, p.status);
    } catch {
      /* se reintenta en la próxima sincronización */
    }
  }
  // 2) Bajar todo junto: si algo falla, no se pisa nada
  const [company, quotes, templates] = await Promise.all([
    fetchCompanyCloud(ctx),
    fetchQuotesCloud(ctx),
    fetchTemplatesCloud(ctx),
  ]);

  if (company && company.nombre.trim()) saveCompany(company);

  const localTpl = getTemplates();
  if (templates.length > 0 || localTpl.length === 0) setTemplates(templates);

  setHistory(quotes);
}

/**
 * Sube todo lo local a una nube vacía (primer login o botón manual).
 * Después normaliza el caché con pullAll (ids y folios del servidor).
 */
export async function importLocal(ctx: CloudCtx): Promise<string> {
  let count = 0;
  const company = getCompany();
  if (company.nombre.trim()) {
    await saveCompanyCloud(ctx, company);
    count++;
  }
  for (const en of getHistory()) {
    await insertQuoteCloud(ctx, en.quote, en.total, en.status);
    count++;
  }
  const tpl = getTemplates();
  for (const t of tpl) {
    await insertTemplateCloud(ctx, {
      descripcion: t.descripcion,
      cantidad: t.cantidad,
      precio: t.precio,
    });
    count++;
  }
  markImported();
  await pullAll(ctx);
  return `Se subieron ${count} registro(s) a la nube ☁️`;
}

/** ¿La nube tiene algo? Sirve para decidir importar vs. bajar. */
export async function hasCloudData(ctx: CloudCtx): Promise<boolean> {
  const [company, quotes, templates] = await Promise.all([
    fetchCompanyCloud(ctx).catch(() => null),
    fetchQuotesCloud(ctx).catch(() => [] as HistoryEntry[]),
    fetchTemplatesCloud(ctx).catch(() => [] as ItemTemplate[]),
  ]);
  return Boolean(
    (company && company.nombre.trim()) ||
      quotes.length > 0 ||
      templates.length > 0,
  );
}
