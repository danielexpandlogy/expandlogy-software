// Sprint 8 (ajustes): un solo tipo de tablero. Cualquiera crea tableros y queda
// dentro; sólo un admin elige quién más entra (al crear o después). El creador no se quita.
import { assert, check, expectError, ok } from "./lib.mjs";

const members = async (client, boardId) =>
  (await ok(client.from("board_members").select("user_id").eq("board_id", boardId))).map((m) => m.user_id).sort();

export default async function sprint8(ctx) {
  const { admin, member, outsider } = ctx;

  await check("cualquier usuario crea varios tableros y queda como único miembro", async () => {
    const a = await ok(member.client.rpc("create_board", { p_name: "Mío 1" }));
    const b = await ok(member.client.rpc("create_board", { p_name: "Mío 2" }));
    assert((await members(member.client, a)).join() === member.id, "miembros de más");
    const sections = await ok(member.client.from("sections").select("id").eq("board_id", b));
    assert(sections.length === 3, "sin secciones iniciales");
    ctx.personalId = a;
  });

  await check("un usuario no puede meter a otras personas (ni al crear ni después)", async () => {
    await expectError(member.client.rpc("create_board", { p_name: "Con otro", p_member_ids: [outsider.id] }), "administrador");
    await expectError(member.client.rpc("set_board_members", { p_board_id: ctx.personalId, p_member_ids: [member.id, outsider.id] }), "administrador");
  });

  await check("el ajeno no ve el tablero de otro", async () => {
    const rows = await ok(outsider.client.from("board_summaries").select("id").eq("id", ctx.personalId));
    assert(rows.length === 0, "lo ve");
  });

  await check("quien lo creó lo renombra y lo archiva", async () => {
    const r = await ok(member.client.from("boards").update({ name: "Renombrado" }).eq("id", ctx.personalId).select());
    assert(r.length === 1 && r[0].name === "Renombrado", "no pudo renombrar");
    const a = await ok(member.client.from("boards").update({ archived_at: new Date().toISOString() }).eq("id", ctx.personalId).select());
    assert(a.length === 1, "no pudo archivar");
  });

  await check("un admin crea un tablero estando solo, y luego añade personas", async () => {
    const id = await ok(admin.client.rpc("create_board", { p_name: "Admin solo" }));
    assert((await members(admin.client, id)).join() === admin.id, "no quedó solo el admin");
    await ok(admin.client.rpc("set_board_members", { p_board_id: id, p_member_ids: [admin.id, member.id, outsider.id] }));
    assert((await members(admin.client, id)).join() === [admin.id, member.id, outsider.id].sort().join(), "no se añadieron");
    for (const who of [member, outsider]) {
      const [row] = await ok(who.client.from("board_summaries").select("is_member,member_count").eq("id", id));
      assert(row && row.is_member && Number(row.member_count) === 3, JSON.stringify(row));
    }
    const people = await ok(outsider.client.rpc("board_people", { p_board_id: id }));
    assert(people.some((p) => p.id === member.id), "los miembros no se ven entre sí");
    ctx.teamId = id;
  });

  await check("un admin crea un tablero con personas desde el inicio", async () => {
    const id = await ok(admin.client.rpc("create_board", { p_name: "Con equipo", p_member_ids: [member.id] }));
    assert((await members(admin.client, id)).join() === [admin.id, member.id].sort().join(), "miembros incorrectos");
  });

  await check("un miembro que no lo creó no renombra ni gestiona personas", async () => {
    const r = await ok(member.client.from("boards").update({ name: "hack" }).eq("id", ctx.teamId).select());
    assert(r.length === 0, "lo renombró");
    await expectError(member.client.rpc("set_board_members", { p_board_id: ctx.teamId, p_member_ids: [member.id] }), "administrador");
  });

  await check("quitar a alguien le quita el acceso; el creador no se puede quitar", async () => {
    await ok(admin.client.rpc("set_board_members", { p_board_id: ctx.teamId, p_member_ids: [member.id] }));
    const sum = await ok(outsider.client.from("board_summaries").select("id").eq("id", ctx.teamId));
    assert(sum.length === 0, "el quitado sigue viéndolo");
    assert((await members(admin.client, ctx.teamId)).join() === [admin.id, member.id].sort().join(), "se quitó al creador");
  });

  await check("un admin también puede añadir personas a un tablero creado por un usuario", async () => {
    const id = await ok(member.client.rpc("create_board", { p_name: "Del usuario" }));
    await ok(admin.client.rpc("set_board_members", { p_board_id: id, p_member_ids: [outsider.id] }));
    assert((await members(admin.client, id)).join() === [member.id, outsider.id].sort().join(), "miembros incorrectos");
    await expectError(admin.client.rpc("create_board", { p_name: "  " }), "nombre");
  });
}
