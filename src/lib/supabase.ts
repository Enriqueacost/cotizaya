import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;

/** true si hay credenciales configuradas (nube disponible). */
export const isCloudConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

let client: SupabaseClient | null = null;

/** Singleton del cliente. null si la nube no está configurada. */
export function getSupabase(): SupabaseClient | null {
  if (!isCloudConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL!, SUPABASE_KEY!);
  }
  return client;
}
