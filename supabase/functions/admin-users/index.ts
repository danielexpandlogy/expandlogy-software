// Alta y baja de usuarios. Sólo para administradores.
//
// Crear/borrar usuarios de Auth requiere la service role key, que nunca puede
// llegar al navegador; por eso vive aquí y no en el frontend. Los cambios de
// rol no pasan por aquí: los hace el admin directamente sobre `profiles` (RLS +
// trigger `guard_profile_update`).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Payload =
  | { action: "create"; email: string; password: string; full_name: string; role: "admin" | "user" }
  | { action: "delete"; user_id: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Cliente con el JWT de quien llama: comprueba sesión y rol respetando RLS.
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json({ error: "No autenticado" }, 401);

  const { data: isAdmin, error: roleError } = await caller.rpc("is_admin");
  if (roleError) return json({ error: roleError.message }, 500);
  if (!isAdmin) return json({ error: "Sólo un administrador puede gestionar usuarios" }, 403);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  if (payload.action === "create") {
    const email = payload.email?.trim().toLowerCase();
    const fullName = payload.full_name?.trim() ?? "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Email inválido" }, 400);
    if (!payload.password || payload.password.length < 8) {
      return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
    }
    if (payload.role !== "admin" && payload.role !== "user") return json({ error: "Rol inválido" }, 400);

    // El rol va en app_metadata: el trigger handle_new_user lo copia a profiles.
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role: payload.role },
    });
    if (error) {
      const alreadyExists = /already|registered|exists/i.test(error.message);
      return json({ error: alreadyExists ? "Ya existe un usuario con ese email" : error.message }, alreadyExists ? 409 : 400);
    }
    return json({ user_id: data.user.id }, 201);
  }

  if (payload.action === "delete") {
    if (!payload.user_id) return json({ error: "Falta user_id" }, 400);
    if (payload.user_id === userData.user.id) return json({ error: "No puedes eliminar tu propia cuenta" }, 400);

    // El perfil y sus tareas se borran en cascada.
    const { error } = await admin.auth.admin.deleteUser(payload.user_id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "Acción desconocida" }, 400);
});
