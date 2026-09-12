import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  cloudSession,
  hasCloudData,
  importLocal,
  pullAll,
  type CloudCtx,
} from "./cloud";
import { getSupabase, isCloudConfigured } from "./supabase";
import { getCompany, getHistory, getTemplates } from "./storage";

export type SyncState =
  | "local" // sin nube o sin sesión: todo en el dispositivo
  | "syncing" // sincronizando con la nube
  | "cloud" // sesión activa + sincronizado
  | "error"; // falló la última sincronización (se sigue en local)

interface AuthValue {
  /** false si no hay .env configurado: la app funciona 100% local. */
  cloudEnabled: boolean;
  user: User | null;
  /** true cuando ya se resolvió la sesión (+ sync inicial si hay usuario). */
  ready: boolean;
  syncState: SyncState;
  syncMessage: string | null;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Baja/sube pendientes ahora. Devuelve mensaje para mostrar. */
  syncNow: () => Promise<string>;
  /** Sube todo lo local a una nube vacía (primer login o manual). */
  importAll: () => Promise<string>;
  /** Sesión de nube lista para operar (null si no hay). */
  ctx: CloudCtx | null;
}

const AuthCtx = createContext<AuthValue | null>(null);

/**
 * true si la URL trae un callback de auth (token del magic link).
 * En ese caso NO hay que redirigir todavía: hay que esperar a que
 * Supabase procese el token, o se pierde y el login entra en bucle.
 */
function isAuthCallback(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hash;
  const s = window.location.search;
  return (
    h.includes("access_token") ||
    h.includes("refresh_token") ||
    /[?&]code=/.test(s) ||
    /[?&]token_hash=/.test(s)
  );
}

/** Limpia el token de la URL una vez establecida la sesión. */
function cleanAuthUrl() {
  try {
    window.history.replaceState(null, "", window.location.pathname);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [ctx, setCtx] = useState<CloudCtx | null>(null);

  const doInitialSync = useCallback(async (c: CloudCtx) => {
    setSyncState("syncing");
    try {
      const hasRemote = await hasCloudData(c);
      if (!hasRemote) {
        // Nube vacía: si hay algo local, se importa (primer login)
        const localHas =
          getCompany().nombre.trim().length > 0 ||
          getHistory().length > 0 ||
          getTemplates().length > 0;
        if (localHas) {
          await importLocal(c);
          setSyncMessage("Tus datos locales se subieron a la nube ☁️");
        } else {
          await pullAll(c);
        }
      } else {
        await pullAll(c);
      }
      setSyncState("cloud");
    } catch {
      setSyncState("error");
      setSyncMessage("Sin conexión a la nube: trabajando en local");
    }
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setReady(true);
      return;
    }
    let alive = true;
    sb.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        const c: CloudCtx = { sb, userId: u.id };
        setCtx(c);
        doInitialSync(c).finally(() => alive && setReady(true));
      } else if (isAuthCallback()) {
        // Viene del enlace del email: esperar a que Supabase procese el
        // token (hasta 15s) antes de decidir. El handler global de abajo
        // establece usuario + sincroniza al llegar SIGNED_IN.
        const timer = setTimeout(() => alive && setReady(true), 15000);
        const { data: waiter } = sb.auth.onAuthStateChange(
          (ev, session) => {
            if (
              (ev === "SIGNED_IN" || ev === "INITIAL_SESSION") &&
              session?.user
            ) {
              clearTimeout(timer);
              waiter.subscription.unsubscribe();
              if (alive) {
                cleanAuthUrl();
                setReady(true);
              }
            }
          },
        );
      } else {
        setReady(true);
      }
    });
    const { data: sub } = sb.auth.onAuthStateChange((ev, session) => {
      if (!alive) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        if (ev === "SIGNED_IN" && isAuthCallback()) cleanAuthUrl();
        const c: CloudCtx = { sb, userId: u.id };
        setCtx(c);
        doInitialSync(c);
      } else {
        setCtx(null);
        setSyncState("local");
        setSyncMessage(null);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [doInitialSync]);

  const sendMagicLink = useCallback(async (email: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error("Nube no configurada");
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      console.error("[auth] signInWithOtp:", error);
      const msg = error.message || "";
      if (error.status === 429 || /rate limit/i.test(msg)) {
        throw new Error(
          "Límite de correos excedido (protección anti-spam de Supabase). " +
            "Esperá ~1 hora e intentá una sola vez, o configurá un SMTP propio " +
            "en el dashboard para no tener límite.",
        );
      }
      throw new Error(msg || "No se pudo enviar el enlace, probá de nuevo");
    }
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setUser(null);
    setCtx(null);
    setSyncState("local");
    setSyncMessage(null);
  }, []);

  const syncNow = useCallback(async () => {
    const c = await cloudSession();
    if (!c) return "Sin sesión: todo queda en este dispositivo";
    setSyncState("syncing");
    try {
      await pullAll(c);
      setCtx(c);
      setSyncState("cloud");
      setSyncMessage(null);
      return "Sincronizado con la nube ☁️";
    } catch {
      setSyncState("error");
      return "No se pudo sincronizar, probá de nuevo";
    }
  }, []);

  const importAll = useCallback(async () => {
    const c = await cloudSession();
    if (!c) return "Sin sesión: iniciá sesión primero";
    setSyncState("syncing");
    try {
      const msg = await importLocal(c);
      setCtx(c);
      setSyncState("cloud");
      setSyncMessage(null);
      return msg;
    } catch {
      setSyncState("error");
      return "No se pudo importar, probá de nuevo";
    }
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      cloudEnabled: isCloudConfigured,
      user,
      ready,
      syncState,
      syncMessage,
      sendMagicLink,
      signOut,
      syncNow,
      importAll,
      ctx,
    }),
    [
      user,
      ready,
      syncState,
      syncMessage,
      sendMagicLink,
      signOut,
      syncNow,
      importAll,
      ctx,
    ],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth fuera de AuthProvider");
  return v;
}
