// Verificador de RLS del To-do List contra el proyecto real de Supabase.
//
//   node scripts/verify-rls/index.mjs            → todos los sprints
//   node scripts/verify-rls/index.mjs --sprint 3 → sólo hasta el sprint 3
//
// Requiere .env (URL + publishable key) y .env.e2e.local (service role key).
// Crea tres identidades temporales (admin, miembro, ajeno) y las borra al final.
import { anon, cleanup, createIdentity, summary } from "./lib.mjs";
import sprint1 from "./sprint-01.mjs";
import sprint4 from "./sprint-04.mjs";
import sprint5 from "./sprint-05.mjs";
import sprint6 from "./sprint-06.mjs";
import sprint7 from "./sprint-07.mjs";

// Los sprints 2 y 3 son de UI (sin cambios de permisos): se cubren en e2e.
const SPRINTS = [sprint1, null, null, sprint4, sprint5, sprint6, sprint7];

const arg = process.argv.indexOf("--sprint");
const upTo = arg > -1 ? Number(process.argv[arg + 1]) : SPRINTS.length;

let exitCode = 1;
try {
  const ctx = {
    admin: await createIdentity("admin", "admin"),
    member: await createIdentity("member", "user"),
    outsider: await createIdentity("outsider", "user"),
    anon: anon(),
  };
  for (const [i, run] of SPRINTS.slice(0, upTo).entries()) {
    if (!run) continue;
    console.log(`\nSprint ${i + 1}`);
    await run(ctx);
  }
  exitCode = summary() ? 1 : 0;
} catch (e) {
  console.error("Error preparando la verificación:", e);
} finally {
  await cleanup();
}
process.exit(exitCode);
