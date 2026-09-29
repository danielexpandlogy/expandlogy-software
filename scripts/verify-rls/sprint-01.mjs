// Sprint 1: tableros, miembros, secciones, tareas y subtareas.
import { assert, check, expectError, ok } from "./lib.mjs";

export default async function sprint1(ctx) {
  const { admin, member, outsider } = ctx;

  await check("un usuario normal no puede crear tableros", () =>
    expectError(member.client.rpc("create_board_for_user", { p_user_id: member.id, p_name: "X" }), "administrador"),
  );

  await check("el admin añade al miembro al To-do List", async () => {
    ctx.boardId = await ok(admin.client.rpc("create_board_for_user", { p_user_id: member.id, p_name: "Tablero RLS" }));
    assert(ctx.boardId, "no devolvió id");
  });

  await check("el tablero nace con 3 secciones ordenadas", async () => {
    const sections = await ok(member.client.from("sections").select("*").eq("board_id", ctx.boardId).order("position"));
    assert(sections.map((s) => s.name).join() === "Por hacer,En progreso,Listo", JSON.stringify(sections.map((s) => s.name)));
    ctx.sections = sections;
  });

  await check("el miembro ve su tablero y su resumen", async () => {
    const boards = await ok(member.client.from("board_summaries").select("*"));
    assert(boards.length === 1 && boards[0].id === ctx.boardId, `ve ${boards.length} tableros`);
  });

  await check("el ajeno no ve el tablero (ni pidiéndolo por id)", async () => {
    const boards = await ok(outsider.client.from("boards").select("id").eq("id", ctx.boardId));
    const summaries = await ok(outsider.client.from("board_summaries").select("id"));
    const sections = await ok(outsider.client.from("sections").select("id").eq("board_id", ctx.boardId));
    assert(boards.length === 0 && summaries.length === 0 && sections.length === 0, "el ajeno ve datos del tablero");
  });

  await check("el ajeno no puede crear secciones ni tareas en el tablero", async () => {
    await expectError(outsider.client.from("sections").insert({ board_id: ctx.boardId, name: "Hack", position: "a9" }));
    await expectError(
      outsider.client.from("tasks").insert({ board_id: ctx.boardId, section_id: ctx.sections[0].id, title: "Hack", position: "a0" }),
    );
  });

  await check("sin sesión no se lee nada", async () => {
    await expectError(ctx.anon.from("boards").select("id"), "permission denied");
    await expectError(ctx.anon.from("tasks").select("id"), "permission denied");
  });

  await check("el miembro crea una tarea y una subtarea", async () => {
    const [task] = await ok(
      member.client
        .from("tasks")
        .insert({ board_id: ctx.boardId, section_id: ctx.sections[0].id, title: "Tarea RLS", position: "a0" })
        .select(),
    );
    const [sub] = await ok(
      member.client.from("tasks").insert({ board_id: ctx.boardId, parent_id: task.id, title: "Sub RLS", position: "a0" }).select(),
    );
    assert(task.created_by === member.id, "created_by no es el miembro");
    ctx.taskId = task.id;
    ctx.subtaskId = sub.id;
  });

  await check("no se permiten subtareas de subtareas", () =>
    expectError(
      member.client.from("tasks").insert({ board_id: ctx.boardId, parent_id: ctx.subtaskId, title: "Nieta", position: "a0" }),
      "no pueden tener subtareas",
    ),
  );

  await check("una subtarea no puede tener sección y una tarea debe tenerla", async () => {
    await expectError(
      member.client
        .from("tasks")
        .insert({ board_id: ctx.boardId, parent_id: ctx.taskId, section_id: ctx.sections[0].id, title: "x", position: "a1" }),
      "tasks_section_xor_parent",
    );
    await expectError(member.client.from("tasks").insert({ board_id: ctx.boardId, title: "x", position: "a1" }), "tasks_section_xor_parent");
  });

  await check("una tarea con subtareas no puede volverse subtarea", async () => {
    const [other] = await ok(
      member.client
        .from("tasks")
        .insert({ board_id: ctx.boardId, section_id: ctx.sections[0].id, title: "Otra", position: "a1" })
        .select(),
    );
    await expectError(
      member.client.from("tasks").update({ parent_id: other.id, section_id: null }).eq("id", ctx.taskId),
      "con subtareas",
    );
  });

  await check("una tarea no puede moverse a otro tablero", async () => {
    const otherBoard = await ok(admin.client.rpc("create_board_for_user", { p_user_id: outsider.id, p_name: "Ajeno" }));
    await expectError(admin.client.from("tasks").update({ board_id: otherBoard }).eq("id", ctx.taskId), "cambiar de tablero");
    ctx.outsiderBoardId = otherBoard;
  });

  await check("el miembro no ve el tablero del ajeno", async () => {
    const rows = await ok(member.client.from("boards").select("id").eq("id", ctx.outsiderBoardId));
    assert(rows.length === 0, "el miembro ve un tablero ajeno");
  });

  await check("completar fija completed_at y descompletar lo borra", async () => {
    const [done] = await ok(member.client.from("tasks").update({ completed: true }).eq("id", ctx.taskId).select());
    assert(done.completed_at, "sin completed_at");
    const [undone] = await ok(member.client.from("tasks").update({ completed: false }).eq("id", ctx.taskId).select());
    assert(undone.completed_at === null, "completed_at no se limpió");
  });

  await check("el miembro no puede renombrar ni archivar su tablero; el admin sí", async () => {
    const byMember = await ok(member.client.from("boards").update({ name: "Hackeado" }).eq("id", ctx.boardId).select());
    assert(byMember.length === 0, "el miembro pudo renombrar");
    const byAdmin = await ok(admin.client.from("boards").update({ name: "Tablero RLS 2" }).eq("id", ctx.boardId).select());
    assert(byAdmin.length === 1 && byAdmin[0].name === "Tablero RLS 2", "el admin no pudo renombrar");
  });

  await check("el miembro no puede añadir miembros a su tablero", () =>
    expectError(member.client.from("board_members").insert({ board_id: ctx.boardId, user_id: outsider.id })),
  );

  await check("el admin ve el tablero del miembro", async () => {
    const boards = await ok(admin.client.from("board_summaries").select("id,pending_count").eq("id", ctx.boardId));
    assert(boards.length === 1 && Number(boards[0].pending_count) === 2, JSON.stringify(boards));
  });
}
