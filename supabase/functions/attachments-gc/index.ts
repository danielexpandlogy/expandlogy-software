// Borra de Storage los adjuntos huérfanos (más de 24 h sin fila en
// comment_attachments): subidas que nunca llegaron a comentario, o de
// comentarios/tareas ya borrados. La programa pg_cron a diario.
//
// No usa JWT (la llama pg_net desde la base): exige el header x-gc-secret, que
// debe coincidir con el secreto GC_SECRET de la función (y con el guardado en
// Vault como attachments_gc_secret para el cron).
import { createClient } from "npm:@supabase/supabase-js@2";

const BATCH = 100;
const MAX_BATCHES = 50;

Deno.serve(async (req) => {
  const secret = Deno.env.get("GC_SECRET");
  if (!secret || req.headers.get("x-gc-secret") !== secret) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let removed = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data, error } = await admin.rpc("attachment_orphans", { p_limit: BATCH });
    if (error) return new Response(JSON.stringify({ error: error.message, removed }), { status: 500 });
    const names = (data ?? []).map((r: { name: string }) => r.name);
    if (!names.length) break;
    const { error: rmError } = await admin.storage.from("task-attachments").remove(names);
    if (rmError) return new Response(JSON.stringify({ error: rmError.message, removed }), { status: 500 });
    removed += names.length;
    if (names.length < BATCH) break;
  }

  console.log(`attachments-gc: ${removed} archivos huérfanos borrados`);
  return new Response(JSON.stringify({ removed }), { headers: { "Content-Type": "application/json" } });
});
