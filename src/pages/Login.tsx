import { useState } from "react";
import { Navigate } from "react-router-dom";
import { cardCls, inputCls, labelCls } from "../components/Layout";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { cloudEnabled, user, ready, sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState(0); // anti-spam: no reenviar antes

  if (!ready) {
    return (
      <div className={cardCls + " text-center"}>
        <p className="font-bold">Cargando...</p>
      </div>
    );
  }
  if (!cloudEnabled || user) return <Navigate to="/nuevo" replace />;

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const mail = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
      setError("Escribí un email válido");
      return;
    }
    // Enfriamiento: cada intento consume cuota del servicio de correo gratuito
    const wait = Math.ceil((retryAfter - Date.now()) / 1000);
    if (wait > 0) {
      setError(`Esperá ${wait}s antes de reintentar (cuota de correos limitada)`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendMagicLink(mail);
      setRetryAfter(Date.now() + 60000);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el enlace");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-sm">
      <div className="text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-black text-white">
          C
        </span>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">
          Cotiza<span className="text-emerald-600">Ya</span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Entrá con tu email para guardar tus presupuestos en la nube.
        </p>
      </div>

      <div className={cardCls + " mt-6"}>
        {sent ? (
          <div className="text-center">
            <p className="text-3xl">📬</p>
            <p className="mt-2 font-bold">Revisá tu correo</p>
            <p className="mt-1 text-sm text-slate-500">
              Te enviamos un enlace a <b>{email.trim()}</b>. Abrilo desde este
              mismo dispositivo para entrar.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-3 text-sm text-slate-400 underline"
            >
              Usar otro email
            </button>
          </div>
        ) : (
          <form onSubmit={onSend} className="space-y-3">
            <div>
              <label className={labelCls} htmlFor="login-email">
                Tu email
              </label>
              <input
                id="login-email"
                name="email"
                className={inputCls}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="vos@tuempresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-sm font-medium text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-emerald-600 py-3 text-base font-bold text-white shadow-lg shadow-emerald-600/25 disabled:opacity-50"
            >
              {busy ? "Enviando..." : "Enviarme el enlace ✨"}
            </button>
            <p className="text-center text-xs text-slate-400">
              Sin contraseña: el enlace entra directo y vale por poco tiempo.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
