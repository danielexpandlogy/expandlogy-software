// Sprint 8 (ajustes): tableros personales para todos y tableros de equipo con varios miembros.
import { assert, check, expectError, ok } from "./lib.mjs";

const members = async (client, boardId) =>
  (await ok(client.from("board_members").select("user_id").eq("board_id", boardId))).map((m) => m.user_id).sort();

export default async function sprint8(ctx) {
  const { admin, member, outsider } = ctx;

  await check("cualquier usuario crea tableros personales, varios, y sólo él es miembro", async () => {
    const a = await ok(member.client.rpc("create_board", { p_name: "Personal 1", p_kind: "personal", p_member_ids: [outsider.id] }));
    const b = await ok(member.client.rpc("create_board", { p_name: "Personal 2" }));
    assert((await members(member.client, a)).join() === member.id, "el personal tiene miembros de más");
    const [row] = await ok(member.client.from("boards").select("kind,owner_id").eq("id", b));
    assert(row.kind === "personal" && row.owner_id === member.id, JSON.stringify(row));
    const sections = await ok(member.client.from("sections").select("id").eq("board_id", b));
    assert(sections.length === 3, "sin secciones iniciales");
    ctx.personalId = a;
  });

  await check("el ajeno no ve el tablero personal de otro", async () => {
    const rows = await ok(outsider.client.from("board_summaries").select("id").eq("id", ctx.personalId));
    assert(rows.length === 0, "lo ve");
  });

  await check("el dueño renombra y archiva su tablero personal", async () => {
    const r = await ok(member.client.from("boards").update({ name: "Renombrado" }).eq("id", ctx.personalId).select());
    assert(r.length === 1 && r[0].name === "Renombrado", "no pudo renombrar");
    const a = await ok(member.client.from("boards").update({ archived_at: new Date().toISOString() }).eq("id", ctx.personalId).select());
    assert(a.length === 1, "no pudo archivar");
  });

  await check("un usuario no puede crear tableros de equipo ni asignar personas", async () => {
    await expectError(member.client.rpc("create_board", { p_name: "Equipo", p_kind: "team", p_member_ids: [outsider.id] }), "administrador");
    await expectError(member.client.rpc("set_board_members", { p_board_id: ctx.boardId, p_member_ids: [member.id, outsider.id] }), "administrador");
  });

  await check("el admin crea un tablero de equipo con varias personas; todas lo ven", async () => {
    const id = await ok(admin.client.rpc("create_board", { p_name: "Equipo Ventas", p_kind: "team", p_member_ids: [member.id, outsider.id] }));
    assert((await members(admin.client, id)).join() === [admin.id, member.id, outsider.id].sort().join(), "miembros incorrectos");
    for (const who of [member, outsider]) {
      const [row] = await ok(who.client.from("board_summaries").select("id,is_member,kind,member_count").eq("id", id));
      assert(row && row.is_member && row.kind === "team" && Number(row.member_count) === 3, JSON.stringify(row));
    }
    const people = await ok(outsider.client.rpc("board_people", { p_board_id: id }));
    assert(people.some((p) => p.id === member.id), "los miembros no se ven entre sí");
    ctx.teamId = id;
  });

  await check("un miembro de equipo no puede renombrar el tablero de equipo", async () => {
    const r = await ok(member.client.from("boards").update({ name: "hack" }).eq("id", ctx.teamId).select());
    assert(r.length === 0, "lo renombró");
  });

  await check("el admin quita a alguien del equipo y pierde el acceso", async () => {
    await ok(admin.client.rpc("set_board_members", { p_board_id: ctx.teamId, p_member_ids: [admin.id, member.id] }));
    const rows = await ok(outsider.client.from("tasks").select("id").eq("board_id", ctx.teamId));
    const sum = await ok(outsider.client.from("board_summaries").select("id").eq("id", ctx.teamId));
    assert(rows.length === 0 && sum.length === 0, "sigue viendo el tablero");
  });

  await check("los tableros personales no se comparten y un equipo no queda vacío", async () => {
    await expectError(admin.client.rpc("set_board_members", { p_board_id: ctx.personalId, p_member_ids: [admin.id] }), "personales");
    await expectError(admin.client.rpc("set_board_members", { p_board_id: ctx.teamId, p_member_ids: [] }), "al menos una");
    await expectError(admin.client.rpc("create_board", { p_name: "  " }), "nombre");
  });
}
