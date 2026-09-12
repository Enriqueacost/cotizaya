import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cardCls } from "../components/Layout";
import {
  downloadPreviewPdf,
  getPdfFilename,
  getPreviewPdfBlob,
} from "../lib/export-pdf";
import { calcQuote, formatGs, itemSubtotal, qtyLabel } from "../lib/quote-math";
import {
  draftToQuote,
  getCompany,
  getDraft,
  getLastQuote,
} from "../lib/storage";
import { IVA_LABELS } from "../lib/types";
import { sendViaWhatsApp } from "../lib/whatsapp";

export default function Preview() {
  const company = getCompany();
  const brand = company.color || "#059669";
  const tint = `color-mix(in srgb, ${brand} 9%, white)`;
  const last = getLastQuote();
  const draft = last ? null : getDraft();
  const quote = last ?? (draft ? draftToQuote(draft) : null);
  const [busy, setBusy] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  if (!quote) {
    return (
      <div className={cardCls + " text-center"}>
        <p className="font-bold">Todavía no hay presupuesto</p>
        <p className="mt-1 text-sm text-slate-500">
          Creá uno primero para ver la vista previa.
        </p>
        <Link
          to="/nuevo"
          className="mt-4 inline-block rounded-2xl bg-emerald-600 px-6 py-3 font-bold text-white"
        >
          Crear presupuesto
        </Link>
      </div>
    );
  }

  const calc = calcQuote(
    quote!.items,
    quote!.descuentoTipo,
    quote!.descuentoValor,
    quote!.ivaMode,
  );
  const fecha = new Date(quote!.fecha).toLocaleDateString("es-PY");

  async function onPdf() {
    if (!quote || !sheetRef.current) return;
    try {
      setBusy("pdf");
      await downloadPreviewPdf(
        sheetRef.current,
        getPdfFilename(quote.fecha),
      );
    } catch {
      alert("No se pudo generar el PDF, probá de nuevo");
    } finally {
      setBusy(null);
    }
  }

  async function onWhatsApp() {
    if (!quote || !sheetRef.current) return;
    try {
      setBusy("wa");
      const blob = await getPreviewPdfBlob(sheetRef.current);
      const file = new File([blob], getPdfFilename(quote.fecha), {
        type: "application/pdf",
      });
      await sendViaWhatsApp(company, quote, file);
    } catch {
      alert("No se pudo preparar el PDF, probá de nuevo");
    } finally {
      setBusy(null);
    }
  }

  const companyRows = [
    company.ruc ? { k: "RUC", v: company.ruc } : null,
    company.telefono ? { k: "Tel", v: company.telefono } : null,
    company.email ? { k: "Email", v: company.email } : null,
    company.direccion ? { k: "Dir", v: company.direccion } : null,
  ].filter(Boolean) as { k: string; v: string }[];

  const clientRows = [
    quote.clienteNombre ? { k: "Nombre", v: quote.clienteNombre } : null,
    quote.clienteRuc ? { k: "RUC", v: quote.clienteRuc } : null,
    quote.clienteTelefono ? { k: "Teléfono", v: quote.clienteTelefono } : null,
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Vista previa</h1>
      <p className="mt-1 text-sm text-slate-500">
        El PDF sale idéntico a esto.
      </p>
      {draft && (
        <div className="mt-2 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm">
          📝 Estás viendo tu borrador actual (se guarda solo). Para
          congelarlo, volvé a{" "}
          <Link to="/nuevo" className="font-bold text-emerald-700 underline">
            Nuevo
          </Link>{" "}
          y tocá "Ver y exportar".
        </div>
      )}

      {/* Hoja (se captura tal cual para el PDF) */}
      <div
        ref={sheetRef}
        className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="p-4 text-white" style={{ backgroundColor: brand }}>
          <div className="flex items-start gap-3">
            {company.logo ? (
              <img
                src={company.logo}
                alt="logo"
                className="h-12 w-12 shrink-0 rounded-xl bg-white object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 text-xl font-black">
                {(company.nombre || "C")[0]}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-lg font-extrabold leading-tight">
                {company.nombre || "Mi Empresa"}
              </div>
              {company.descripcion && (
                <div className="mt-0.5 text-xs leading-snug opacity-90">
                  {company.descripcion}
                </div>
              )}
              {companyRows.length > 0 && (
                <dl className="mt-2 space-y-0.5 text-xs">
                  {companyRows.map((r) => (
                    <div key={r.k} className="flex gap-1.5">
                      <dt className="w-10 shrink-0 font-semibold opacity-70">{r.k}</dt>
                      <dd className="min-w-0 flex-1 break-words">{r.v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </div>

        <div className="p-4">
          <div>
            <div className="text-xl font-extrabold">Presupuesto</div>
            <div className="text-sm text-slate-500">Fecha: {fecha}</div>
          </div>

          <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: tint }}>
            <div
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: brand }}
            >
              Cliente
            </div>
            {clientRows.length > 0 ? (
              <dl className="mt-1.5 space-y-1 text-sm">
                {clientRows.map((r) => (
                  <div key={r.k} className="flex gap-2">
                    <dt className="w-20 shrink-0 text-slate-500">{r.k}</dt>
                    <dd className="min-w-0 flex-1 break-words font-medium">{r.v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-1 text-sm text-slate-500">—</p>
            )}
            {quote.notas && (
              <div className="mt-2 border-t border-black/5 pt-2 text-sm text-slate-600">
                <span className="font-semibold">Notas: </span>
                {quote.notas}
              </div>
            )}
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white" style={{ backgroundColor: brand }}>
                  <th className="rounded-l-lg px-2 py-2 text-left font-semibold">#</th>
                  <th className="px-2 py-2 text-left font-semibold">Descripción</th>
                  <th className="px-2 py-2 text-center font-semibold">Cant.</th>
                  <th className="rounded-r-lg px-2 py-2 text-right font-semibold">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((it, i) => (
                  <tr key={it.id} className={i % 2 ? "bg-slate-50" : ""}>
                    <td className="px-2 py-2 text-slate-500">{i + 1}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{it.descripcion || "-"}</div>
                      <div className="text-xs text-slate-500">
                        {Number(it.cantidad) > 0
                          ? `${it.cantidad} × ${formatGs(it.precio)}`
                          : `Servicio • ${formatGs(it.precio)}`}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">{qtyLabel(it)}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right font-semibold">
                      {formatGs(itemSubtotal(it))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="mt-3 space-y-1 border-t border-dashed border-slate-200 pt-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <dt>Subtotal</dt>
              <dd className="font-semibold">{formatGs(calc.subtotal)}</dd>
            </div>
            {calc.descuentoMonto > 0 && (
              <div className="flex justify-between text-slate-600">
                <dt>Descuento</dt>
                <dd>- {formatGs(calc.descuentoMonto)}</dd>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <dt>{IVA_LABELS[quote.ivaMode]}</dt>
              <dd>{formatGs(calc.ivaMonto)}</dd>
            </div>
            <div
              className="flex justify-between rounded-xl px-3 py-2 text-base font-extrabold text-white"
              style={{ backgroundColor: brand }}
            >
              <dt>TOTAL</dt>
              <dd>{formatGs(calc.total)}</dd>
            </div>
          </dl>

          {company.condiciones && (
            <p className="mt-3 text-xs text-slate-500">{company.condiciones}</p>
          )}
          <p className="mt-1 text-center text-[11px] text-slate-400">
            Generado con CotizaYa • {fecha}
          </p>
        </div>
      </div>

      {/* Export bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur [padding-bottom:env(safe-area-inset-bottom)]">
        <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-2 px-4 py-3 md:max-w-3xl">
          <button
            onClick={onPdf}
            disabled={busy !== null}
            className="rounded-2xl bg-red-600 py-3 text-sm font-bold text-white shadow active:scale-[0.98] disabled:opacity-60"
          >
            {busy === "pdf" ? "⏳ Generando..." : "📄 Descargar PDF"}
          </button>
          <button
            onClick={onWhatsApp}
            disabled={busy !== null}
            className="rounded-2xl bg-[#25D366] py-3 text-sm font-bold text-white shadow active:scale-[0.98] disabled:opacity-60"
          >
            {busy === "wa" ? "⏳..." : "💬 WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  );
}
