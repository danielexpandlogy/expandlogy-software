import { readFileSync, existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

function loadEnv(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.e2e.local"), ...process.env } as Record<string, string>;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const service = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, noSession);

export interface Identity {
  id: string;
  email: string;
  password: string;
  name: string;
  /** Cliente con la sesión de esta identidad (para preparar datos por API). */
  client: SupabaseClient;
  /** Estado compartido entre tests seriales del mismo archivo. */
  boardUrl?: string;
}

export async function createIdentity(label: string, role: "admin" | "user"): Promise<Identity> {
  const tag = Math.random().toString(36).slice(2, 8);
  const email = `e2e-${label}-${tag}@example.com`;
  const password = `Pw-${tag}-${Math.random().toString(36).slice(2)}`;
  const name = `E2E ${label[0].toUpperCase()}${label.slice(1)} ${tag}`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
    app_metadata: { role },
  });
  if (error) throw error;
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, noSession);
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, email, password, name, client };
}

export async function deleteIdentity(identity: Identity) {
  // Que falle en voz alta: un borrado fallido dejaba usuarios de prueba en la base.
  const { error } = await service.auth.admin.deleteUser(identity.id);
  if (error) throw new Error(`No se pudo borrar ${identity.email}: ${error.message}`);
}

export async function login(page: Page, who: Identity) {
  // Si ya había otra sesión, /login redirige (en el cliente, tras cargar): se
  // borra siempre la sesión guardada antes de entrar con otra identidad.
  await page.goto("/login");
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/login");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Crea el tablero de `owner` por API (como lo haría un admin desde la UI). */
export async function createBoardFor(admin: Identity, owner: Identity, name = `Tablero de ${owner.name}`) {
  // Las identidades se comparten por worker: si otro archivo ya le creó un
  // tablero, se archiva (como haría un admin) para respetar "uno activo por usuario".
  await admin.client.from("boards").update({ archived_at: new Date().toISOString() }).eq("owner_id", owner.id).is("archived_at", null);
  const { data, error } = await admin.client.rpc("create_board_for_user", { p_user_id: owner.id, p_name: name });
  if (error) throw error;
  return data as string;
}

/** Espera a que una escritura a PostgREST termine con éxito (evita carreras con page.goto). */
export function waitForWrite(page: Page, table: string, method: "POST" | "PATCH" | "DELETE" = "POST") {
  return page.waitForResponse(async (r) => {
    if (!r.url().includes(`/rest/v1/${table}`) || r.request().method() !== method) return false;
    if (!r.ok()) throw new Error(`${method} ${table} → ${r.status()} ${await r.text()}`);
    return true;
  });
}

/** Espera a que terminen las animaciones (p. ej. el panel que entra deslizándose) antes de medir posiciones. */
export async function settleAnimations(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
}
