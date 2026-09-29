// Utilidades del verificador de RLS: crea identidades temporales contra el
// proyecto real de Supabase y las borra al terminar.
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

export const env = { ...loadEnv(".env"), ...loadEnv(".env.e2e.local"), ...process.env };
export const URL = env.VITE_SUPABASE_URL;
export const ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (.env) o SUPABASE_SERVICE_ROLE_KEY (.env.e2e.local)");
  process.exit(2);
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
export const service = createClient(URL, SERVICE_KEY, noSession);
export const anon = () => createClient(URL, ANON_KEY, noSession);

const created = [];

export async function createIdentity(label, role) {
  const tag = Math.random().toString(36).slice(2, 8);
  const email = `rls-${label}-${tag}@example.com`;
  const password = `Pw-${tag}-${Math.random().toString(36).slice(2)}`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RLS ${label}` },
    app_metadata: { role },
  });
  if (error) throw error;
  created.push(data.user.id);
  const client = anon();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, password, client };
}

export async function cleanup() {
  for (const id of created) {
    const { error } = await service.auth.admin.deleteUser(id);
    if (error) console.error(`  ✗ no se pudo borrar la identidad ${id}: ${error.message}`), (process.exitCode = 1);
  }
}

let passed = 0;
const failures = [];

export async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}

export function summary() {
  console.log(`\n${passed} ok, ${failures.length} fallidas`);
  return failures.length;
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Espera que la operación falle (error de PostgREST/RPC). */
export async function expectError(promise, match) {
  const { error } = await promise;
  assert(error, "se esperaba un error y la operación tuvo éxito");
  if (match) assert(new RegExp(match, "i").test(error.message), `error inesperado: ${error.message}`);
}

/** Espera éxito y devuelve data. */
export async function ok(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
}
