import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cardCls, inputCls } from "../components/Layout";
import { useAuth } from "../lib/auth";
import {
  cloudSession,
  deleteQuoteCloud,
  isCloudId,
  updateQuoteStatusCloud,
} from "../lib/cloud";
import { formatGs } from "../lib/quote-math";
import {
  deleteHistoryEntry,
  getHistory,
  saveDraft,
  saveLastQuote,
  updateHistoryStatus,
} from "../lib/storage";
import {
  STATUS_LABELS,
  type HistoryEntry,
  type QuoteStatus,
} from "../lib/types";

const STATUS_STYLE: Record<QuoteStatus, string> = {
  borrador: "bg-slate-100 text-slate-600",
  enviado: "bg-blue-100 text-blue-700",
  aprobado: "bg-emerald-100 text-emerald-700",
};

const FILTERS: ("todas" | QuoteStatus)[] = ["todas", "borrador", "enviado", "aprobado"];

export default function History() {
  const nav = useNavigate();
  const auth = useAuth();
  const [entries, setEntries] = useState<HistoryEntry[]>(() => getHistory());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("todas");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter !== "todas" && e.status !== filter) return false;
      if (!q) return true;
      return (
        e.clienteNombre.toLowerCase().includes(q) ||
        e.folio.includes(q)
      );
    });
  }, [entries, search, filter]);

  function refresh() {
    setEntries(getHistory());
  }

  function onView(e: HistoryEntry) {
    saveLastQuote(e.quote);
    nav("/preview");
  }

  function onDuplicate(e: HistoryEntry) {
    saveDraft({
      fechaInput: new Date().toISOString().slice(0, 10),
      clienteNombre: e.quote.clienteNombre,
      clienteRuc: e.quote.clienteRuc,
      clienteTelefono: e.quote.clienteTelefono,
      items: e.quote.items.map((it) => ({ ...it })),
      descuentoTipo: e.quote.descuentoTipo,
      descuentoValor: e.quote.descuentoValor,
      ivaMode: e.quote.ivaMode,
      notas: e.quote.notas,
    });
    nav("/nuevo");
  }

  async function onDelete(e: HistoryEntry) {
    if (!confirm(`¿Eliminar el presupuesto Nº ${e.folio}?`)) return;
    deleteHistoryEntry(e.id);
    const c = auth.ctx ?? (await cloudSession());
    if (c && isCloudId(e.id)) {
      try {
        await deleteQuoteCloud(c, e.id);
      } catch {
        alert("Se borró en este dispositivo, pero no se pudo borrar en la nube");
      }
    }
    refresh();
  }

  async function onStatus(e: HistoryEntry, s: QuoteStatus) {
    updateHistoryStatus(e.id, s);
    const c = auth.ctx ?? (await cloudSession());
    if (c && isCloudId(e.id)) {
      try {
        await updateQuoteStatusCloud(c, e.id, s);
      } catch {
        /* queda en local, se sincroniza después */
      }
    }
    refresh();
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Historial</h1>
      <p className="mt-1 text-sm text-slate-500">
        Todos tus presupuestos generados, con folio interno.
      </p>

      <div className="mt-4 space-y-3">
        <input
          className={inputCls}
          placeholder="🔍 Buscar por cliente o folio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                filter === f
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {f === "todas" ? "Todas" : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={cardCls + " mt-4 text-center"}>
          <p className="font-bold">Sin resultados</p>
          <p className="mt-1 text-sm text-slate-500">
            {entries.length === 0
              ? "Todavía no generaste presupuestos."
              : "Probá con otra búsqueda o filtro."}
          </p>
          {entries.length === 0 && (
            <Link
              to="/nuevo"
              className="mt-4 inline-block rounded-2xl bg-emerald-600 px-6 py-3 font-bold text-white"
            >
              Crear el primero
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filtered.map((e) => (
            <div key={e.id} className={cardCls + " space-y-2"}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
                      Nº {e.folio}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(e.fecha).toLocaleDateString("es-PY")}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-bold">{e.clienteNombre}</div>
                </div>
                <div className="shrink-0 text-right font-extrabold text-emerald-700">
                  {formatGs(e.total)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(STATUS_LABELS) as QuoteStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => onStatus(e, s)}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      e.status === s
                        ? STATUS_STYLE[s] + " ring-2 ring-slate-900/20"
                        : "bg-slate-50 text-slate-400"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 border-t border-slate-100 pt-2">
                <button
                  onClick={() => onView(e)}
                  className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-bold text-white"
                >
                  Ver
                </button>
                <button
                  onClick={() => onDuplicate(e)}
                  className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-bold text-slate-700"
                >
                  Duplicar
                </button>
                <button
                  onClick={() => onDelete(e)}
                  className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-500"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
