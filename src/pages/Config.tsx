import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cardCls, inputCls, labelCls } from "../components/Layout";
import {
  BRAND_PRESETS,
  fileToDataURL,
  getCompany,
  saveCompany,
} from "../lib/storage";
import { useAuth } from "../lib/auth";
import { cloudSession, saveCompanyCloud } from "../lib/cloud";
import type { Company, IvaMode } from "../lib/types";

export default function Config() {
  const nav = useNavigate();
  const auth = useAuth();
  const [form, setForm] = useState<Company>(() => getCompany());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cloudMsg, setCloudMsg] = useState<string | null>(null);

  const set = <K extends keyof Company>(k: K, v: Company[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataURL(file);
    set("logo", dataUrl);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (form.nombre.trim().length < 2) {
      alert("Colocá al menos el nombre de tu empresa");
      return;
    }
    saveCompany(form);
    // Con sesión: también a la nube (el logo se sube al Storage)
    const c = auth.ctx ?? (await cloudSession());
    if (c) {
      setSaving(true);
      try {
        const normalized = await saveCompanyCloud(c, form);
        if (normalized.logo !== form.logo) {
          setForm((f) => ({ ...f, logo: normalized.logo }));
          saveCompany({ ...form, logo: normalized.logo });
        }
      } catch {
        alert("Se guardó en este dispositivo, pero no se pudo subir a la nube");
      } finally {
        setSaving(false);
      }
    }
    setSaved(true);
    setTimeout(() => nav("/nuevo"), 600);
  }

  async function onSyncNow() {
    setCloudMsg("Sincronizando...");
    setCloudMsg(await auth.syncNow());
  }

  async function onImport() {
    if (!confirm("¿Subir los datos de este dispositivo a la nube?")) return;
    setCloudMsg("Subiendo...");
    setCloudMsg(await auth.importAll());
    setForm(getCompany());
  }

  async function onSignOut() {
    if (!confirm("¿Cerrar sesión? Tus datos quedan en este dispositivo.")) return;
    await auth.signOut();
    nav("/login");
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">
        Configuración inicial
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Una sola vez: estos datos salen pre-cargados en todos tus presupuestos.
      </p>

      <form onSubmit={onSave} className="mt-4 space-y-4">
        <div className={cardCls}>
          <span className={labelCls}>Logo de tu empresa</span>
          <div className="flex items-center gap-3">
            {form.logo ? (
              <img
                src={form.logo}
                alt="logo"
                className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                🏷️
              </div>
            )}
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={onLogo}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              {form.logo && (
                <button
                  type="button"
                  onClick={() => set("logo", "")}
                  className="mt-1 text-xs text-red-500"
                >
                  Quitar logo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={cardCls + " space-y-3"}>
          <div>
            <label className={labelCls}>Nombre empresa *</label>
            <input
              className={inputCls}
              placeholder="Ej: Servicios González"
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Descripción del negocio</label>
            <textarea
              className={inputCls + " min-h-16"}
              placeholder="Ej: Electricidad, refrigeración y mantenimiento en general"
              value={form.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>RUC</label>
              <input
                className={inputCls}
                inputMode="numeric"
                placeholder="80012345-1"
                value={form.ruc}
                onChange={(e) => set("ruc", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input
                className={inputCls}
                inputMode="tel"
                placeholder="0981 123 456"
                value={form.telefono}
                onChange={(e) => set("telefono", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input
              className={inputCls}
              inputMode="email"
              placeholder="contacto@miempresa.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Dirección</label>
            <input
              className={inputCls}
              placeholder="Av. Mariscal López 123, Asunción"
              value={form.direccion}
              onChange={(e) => set("direccion", e.target.value)}
            />
          </div>
        </div>

        <div className={cardCls + " space-y-3"}>
          <div>
            <label className={labelCls}>Color de tu marca</label>
            <div className="flex flex-wrap gap-2">
              {BRAND_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("color", c)}
                  aria-label={`Color ${c}`}
                  className={`h-11 w-11 rounded-full transition active:scale-95 ${form.color === c ? "ring-2 ring-slate-900 ring-offset-2" : "ring-1 ring-slate-200"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Se usa en el header, la tabla y el total de tus presupuestos.
            </p>
          </div>
          <div>
            <label className={labelCls}>IVA por defecto</label>
            <select
              className={inputCls}
              value={form.ivaDefault}
              onChange={(e) => set("ivaDefault", e.target.value as IvaMode)}
            >
              <option value="incl10">IVA 10% incluido</option>
              <option value="mas10">IVA 10% adicional</option>
              <option value="mas5">IVA 5% adicional</option>
              <option value="exenta">Exenta</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Condiciones por defecto</label>
            <textarea
              className={inputCls + " min-h-20"}
              value={form.condiciones}
              onChange={(e) => set("condiciones", e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-2xl bg-emerald-600 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-600/25 active:scale-[0.99] disabled:opacity-60"
        >
          {saving ? "Subiendo a la nube..." : saved ? "✅ Guardado, vamos..." : "Guardar y empezar a cotizar"}
        </button>
      </form>

      {auth.cloudEnabled && (
        <div className={cardCls + " mt-4 space-y-3"}>
          <h2 className="font-bold">☁️ Cuenta y nube</h2>
          {auth.user ? (
            <>
              <p className="text-sm text-slate-600">
                Sesión: <b>{auth.user.email}</b>
              </p>
              <p className="text-sm">
                Estado:{" "}
                {auth.syncState === "cloud" && (
                  <span className="font-bold text-emerald-600">● Sincronizado</span>
                )}
                {auth.syncState === "syncing" && (
                  <span className="font-bold text-amber-600">● Sincronizando...</span>
                )}
                {auth.syncState === "local" && (
                  <span className="font-bold text-slate-500">● Solo local</span>
                )}
                {auth.syncState === "error" && (
                  <span className="font-bold text-red-500">● Sin conexión</span>
                )}
              </p>
              {auth.syncMessage && (
                <p className="text-sm text-slate-500">{auth.syncMessage}</p>
              )}
              {cloudMsg && (
                <p className="text-sm font-medium text-emerald-700">{cloudMsg}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onSyncNow}
                  className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white"
                >
                  Sincronizar ahora
                </button>
                <button
                  type="button"
                  onClick={onImport}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-bold text-slate-700"
                >
                  Subir datos locales
                </button>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="w-full text-center text-sm text-red-500 underline"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Sin sesión: todo se guarda solo en este dispositivo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
