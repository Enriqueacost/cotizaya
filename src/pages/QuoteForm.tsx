import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cardCls, inputCls, labelCls } from "../components/Layout";
import { calcQuote, formatGs, itemSubtotal } from "../lib/quote-math";
import { useAuth } from "../lib/auth";
import {
  cloudSession,
  deleteTemplateCloud,
  insertQuoteCloud,
  insertTemplateCloud,
  isCloudId,
} from "../lib/cloud";
import {
  addHistoryEntry,
  deleteTemplate,
  getCompany,
  getDraft,
  getHistory,
  getTemplates,
  hasCompany,
  saveDraft,
  saveLastQuote,
  saveTemplate,
  setHistory,
  setTemplates as setTemplatesLocal,
} from "../lib/storage";
import { IVA_LABELS, type IvaMode, type ItemTemplate, type QuoteItem } from "../lib/types";

const uid = () => Math.random().toString(36).slice(2, 9);
const todayInput = () => new Date().toISOString().slice(0, 10);

export default function QuoteForm() {
  const nav = useNavigate();
  const auth = useAuth();
  const company = getCompany();
  // El borrador persiste en localStorage: cambiar de pestaña o recargar no borra nada.
  const [initial] = useState(getDraft);
  const [fechaInput, setFechaInput] = useState(initial?.fechaInput || todayInput());
  const [clienteNombre, setClienteNombre] = useState(initial?.clienteNombre || "");
  const [clienteRuc, setClienteRuc] = useState(initial?.clienteRuc || "");
  const [clienteTelefono, setClienteTelefono] = useState(initial?.clienteTelefono || "");
  const [items, setItems] = useState<QuoteItem[]>(
    initial?.items?.length
      ? initial.items
      : [{ id: uid(), descripcion: "", cantidad: 0, precio: 0 }],
  );
  const [descuentoTipo, setDescuentoTipo] = useState<"pct" | "monto">(
    initial?.descuentoTipo || "pct",
  );
  const [descuentoValor, setDescuentoValor] = useState(initial?.descuentoValor || 0);
  const [ivaMode, setIvaMode] = useState<IvaMode>(
    initial?.ivaMode || company.ivaDefault || "incl10",
  );
  const [notas, setNotas] = useState(initial?.notas || "");
  const [templates, setTemplates] = useState<ItemTemplate[]>(() => getTemplates());
  const [managingTpl, setManagingTpl] = useState(false);
  const [saving, setSaving] = useState(false);

  // Autoguardado del borrador en cada cambio
  useEffect(() => {
    saveDraft({
      fechaInput,
      clienteNombre,
      clienteRuc,
      clienteTelefono,
      items,
      descuentoTipo,
      descuentoValor,
      ivaMode,
      notas,
    });
  }, [
    fechaInput,
    clienteNombre,
    clienteRuc,
    clienteTelefono,
    items,
    descuentoTipo,
    descuentoValor,
    ivaMode,
    notas,
  ]);

  const calc = useMemo(
    () => calcQuote(items, descuentoTipo, descuentoValor, ivaMode),
    [items, descuentoTipo, descuentoValor, ivaMode],
  );

  const updateItem = (id: string, patch: Partial<QuoteItem>) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const removeItem = (id: string) =>
    setItems((list) => (list.length > 1 ? list.filter((it) => it.id !== id) : list));

  async function onContinue() {
    if (!items.some((i) => i.descripcion.trim() && Number(i.precio) > 0)) {
      alert("Agregá al menos un servicio/producto con descripción y precio");
      return;
    }
    if (saving) return;
    const fecha = fechaInput
      ? new Date(fechaInput + "T12:00:00").toISOString()
      : new Date().toISOString();
    const quote = {
      numero: "",
      fecha,
      clienteNombre,
      clienteRuc,
      clienteTelefono,
      items,
      descuentoTipo,
      descuentoValor,
      ivaMode,
      validezDias: 0,
      notas,
    };
    saveLastQuote(quote);
    // Cada presupuesto generado queda en el historial con folio interno.
    // Con sesión: folio autoritativo del servidor; sin sesión/red: local.
    setSaving(true);
    try {
      const c = auth.ctx ?? (await cloudSession());
      if (c) {
        try {
          const entry = await insertQuoteCloud(c, quote, calc.total);
          setHistory([entry, ...getHistory()]);
        } catch {
          addHistoryEntry(quote, calc.total);
        }
      } else {
        addHistoryEntry(quote, calc.total);
      }
    } finally {
      setSaving(false);
    }
    nav("/preview");
  }

  async function saveAsTemplate(it: QuoteItem) {
    if (!it.descripcion.trim()) {
      alert("Escribí la descripción primero");
      return;
    }
    const t = {
      descripcion: it.descripcion.trim(),
      cantidad: Number(it.cantidad) || 0,
      precio: Number(it.precio) || 0,
    };
    const c = auth.ctx ?? (await cloudSession());
    if (c) {
      try {
        const saved = await insertTemplateCloud(c, t);
        const list = [saved, ...getTemplates()].slice(0, 30);
        setTemplatesLocal(list);
        setTemplates(list);
        return;
      } catch {
        /* cae al guardado local */
      }
    }
    setTemplates(saveTemplate(t));
  }

  async function removeTemplate(id: string) {
    const c = auth.ctx ?? (await cloudSession());
    if (c && isCloudId(id)) {
      try {
        await deleteTemplateCloud(c, id);
      } catch {
        /* el local igual se borra */
      }
    }
    setTemplates(deleteTemplate(id));
  }

  return (
    <div>
      {!hasCompany() && (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
          ⚠️ Todavía no configuraste tu empresa.{" "}
          <Link to="/config" className="font-bold text-emerald-700 underline">
            Hacelo acá
          </Link>{" "}
          para que salga en el presupuesto.
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Nuevo presupuesto</h1>
        <button
          onClick={() => {
            if (!confirm("¿Limpiar todo el presupuesto?")) return;
            setFechaInput(todayInput());
            setClienteNombre("");
            setClienteRuc("");
            setClienteTelefono("");
            setItems([{ id: uid(), descripcion: "", cantidad: 0, precio: 0 }]);
            setDescuentoTipo("pct");
            setDescuentoValor(0);
            setIvaMode(company.ivaDefault || "incl10");
            setNotas("");
          }}
          className="text-xs font-medium text-slate-400 underline"
        >
          Limpiar
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <section className={cardCls + " space-y-3"}>
          <div>
            <label className={labelCls}>Fecha del presupuesto</label>
            <input
              className={inputCls}
              type="date"
              value={fechaInput}
              onChange={(e) => setFechaInput(e.target.value)}
            />
          </div>
        </section>

        <section className={cardCls + " space-y-3"}>
          <h2 className="font-bold">👤 Cliente</h2>
          <div>
            <label className={labelCls}>Nombre / Empresa</label>
            <input
              className={inputCls}
              placeholder="¿A quién le cotizás?"
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>RUC cliente</label>
              <input
                className={inputCls}
                placeholder="Opcional"
                value={clienteRuc}
                onChange={(e) => setClienteRuc(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input
                className={inputCls}
                inputMode="tel"
                placeholder="Opcional"
                value={clienteTelefono}
                onChange={(e) => setClienteTelefono(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">🧾 Servicios / Productos</h2>
            <button
              onClick={() =>
                setItems((l) => [...l, { id: uid(), descripcion: "", cantidad: 0, precio: 0 }])
              }
              className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-700"
            >
              + Agregar
            </button>
          </div>
          {templates.length > 0 && (
            <div className={cardCls}>
              <div className="mb-2 flex items-center justify-between">
                <span className={labelCls + " mb-0"}>⭐ Frecuentes (tocá para agregar)</span>
                <button
                  onClick={() => setManagingTpl((v) => !v)}
                  className="text-xs text-slate-400 underline"
                >
                  {managingTpl ? "Listo" : "Editar"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1.5 pl-3 pr-1.5 text-sm"
                  >
                    <button
                      onClick={() =>
                        setItems((l) => [
                          ...l,
                          {
                            id: uid(),
                            descripcion: t.descripcion,
                            cantidad: t.cantidad,
                            precio: t.precio,
                          },
                        ])
                      }
                      className="max-w-44 truncate font-medium"
                    >
                      {t.descripcion}
                    </button>
                    {managingTpl && (
                      <button
                        onClick={() => removeTemplate(t.id)}
                        aria-label="Eliminar frecuente"
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-300 text-xs text-white"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
          {items.map((it, idx) => (
            <div key={it.id} className={cardCls + " space-y-2"}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">ÍTEM {idx + 1}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => saveAsTemplate(it)}
                    className="text-xs font-medium text-amber-500"
                    title="Guardar en frecuentes"
                  >
                    ★ Guardar
                  </button>
                  <button
                    onClick={() => removeItem(it.id)}
                    className="text-xs font-medium text-red-500"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              <input
                className={inputCls}
                placeholder="Descripción: Ej. Instalación de aire 12000 BTU"
                value={it.descripcion}
                onChange={(e) => updateItem(it.id, { descripcion: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Cantidad (opcional)</label>
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={it.cantidad || ""}
                    placeholder="—"
                    onChange={(e) =>
                      updateItem(it.id, {
                        cantidad: e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Precio Gs.</label>
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={it.precio || ""}
                    placeholder="0"
                    onChange={(e) =>
                      updateItem(it.id, { precio: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="text-right text-sm font-bold text-slate-600">
                = {formatGs(itemSubtotal(it))}
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-500">
            Si es un servicio sin cantidad, dejá la cantidad vacía: se cobra como 1.
          </p>
        </section>

        <section className={cardCls + " space-y-3"}>
          <h2 className="font-bold">💰 Totales</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Descuento</label>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  value={descuentoValor || ""}
                  placeholder="0"
                  onChange={(e) => setDescuentoValor(Number(e.target.value))}
                />
                <select
                  className={inputCls + " max-w-24"}
                  value={descuentoTipo}
                  onChange={(e) =>
                    setDescuentoTipo(e.target.value as "pct" | "monto")
                  }
                >
                  <option value="pct">%</option>
                  <option value="monto">Gs.</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>IVA</label>
              <select
                className={inputCls}
                value={ivaMode}
                onChange={(e) => setIvaMode(e.target.value as IvaMode)}
              >
                <option value="incl10">10% incluido</option>
                <option value="mas10">10% adicional</option>
                <option value="mas5">5% adicional</option>
                <option value="exenta">Exenta</option>
              </select>
            </div>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-600">
              <dt>Subtotal</dt>
              <dd className="font-semibold">{formatGs(calc.subtotal)}</dd>
            </div>
            {calc.descuentoMonto > 0 && (
              <div className="flex justify-between text-slate-600">
                <dt>Descuento</dt>
                <dd className="font-semibold">- {formatGs(calc.descuentoMonto)}</dd>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <dt>{IVA_LABELS[ivaMode]}</dt>
              <dd className="font-semibold">{formatGs(calc.ivaMonto)}</dd>
            </div>
          </dl>
          <div>
            <label className={labelCls}>Notas</label>
            <input
              className={inputCls}
              placeholder="Opcional"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
        </section>
      </div>

      {/* Sticky total bar - mobile first */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur [padding-bottom:env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-3 md:max-w-3xl">
          <div>
            <div className="text-xs text-slate-500">TOTAL</div>
            <div className="text-xl font-extrabold text-emerald-700">
              {formatGs(calc.total)}
            </div>
          </div>
          <button
            onClick={onContinue}
            disabled={saving}
            className="flex-1 rounded-2xl bg-emerald-600 py-3 text-base font-bold text-white shadow-lg shadow-emerald-600/25 active:scale-[0.99] disabled:opacity-60 md:max-w-64"
          >
            {saving ? "Guardando..." : "Ver y exportar →"}
          </button>
        </div>
      </div>
    </div>
  );
}
