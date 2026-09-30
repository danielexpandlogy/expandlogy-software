/**
 * Conexión mínima con Supabase para las landings: sólo llama a las funciones
 * públicas lp_* por HTTP, sin supabase-js (la landing pesa menos y nunca tiene
 * sesión). Cada landing la configura una vez al arrancar.
 */

export interface LandingLabConfig {
  supabaseUrl: string;
  /** Clave pública (anon o sb_publishable_…). Nunca la service role. */
  supabaseAnonKey: string;
}

let current: LandingLabConfig | null = null;

export function configureLandingLab(config: LandingLabConfig) {
  current = { supabaseUrl: config.supabaseUrl.replace(/\/+$/, ""), supabaseAnonKey: config.supabaseAnonKey };
}

export async function rpc<T>(fn: string, args: Record<string, unknown>, init: { keepalive?: boolean } = {}): Promise<T> {
  if (!current?.supabaseUrl || !current.supabaseAnonKey) {
    throw new Error("Falta configureLandingLab({ supabaseUrl, supabaseAnonKey })");
  }
  const { supabaseUrl, supabaseAnonKey } = current;
  const headers: Record<string, string> = { apikey: supabaseAnonKey, "Content-Type": "application/json" };
  // Las claves anon antiguas son JWT y también van como Authorization; las
  // sb_publishable_ sólo como apikey.
  if (supabaseAnonKey.startsWith("eyJ")) headers.Authorization = `Bearer ${supabaseAnonKey}`;

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
    keepalive: init.keepalive,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message = data && typeof data === "object" && "message" in data ? String(data.message) : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}
