// Sprint 5: comentarios planos en tareas y subtareas.
import { assert, check, expectError, ok } from "./lib.mjs";

export default async function sprint5(ctx) {
  const { admin, member, outsider } = ctx;

  await check("el miembro comenta vía create_comment; board_id y autor los fija el servidor", async () => {
    const c = await ok(member.client.rpc("create_comment", { p_task_id: ctx.taskId, p_body: "  Hola equipo  " }));
    assert(c.board_id === ctx.boardId && c.author_id === member.id && c.body === "Hola equipo", JSON.stringify(c));
    ctx.memberComment = c.id;
  });

  await check("también se comentan subtareas (hilo propio)", async () => {
    const c = await ok(member.client.rpc("create_comment", { p_task_id: ctx.subtaskId, p_body: "En la subtarea" }));
    const onTask = await ok(member.client.from("task_comments").select("id").eq("task_id", ctx.taskId));
    assert(c.task_id === ctx.subtaskId && !onTask.some((x) => x.id === c.id), "el comentario de la subtarea aparece en la tarea");
  });

  await check("comentario vacío o de más de 5000 caracteres → rechazado", async () => {
    await expectError(member.client.rpc("create_comment", { p_task_id: ctx.taskId, p_body: "   " }), "vacío");
    await expectError(member.client.rpc("create_comment", { p_task_id: ctx.taskId, p_body: "x".repeat(5001) }), "5000");
  });

  await check("no se puede insertar directo en task_comments (sólo vía RPC)", () =>
    expectError(member.client.from("task_comments").insert({ task_id: ctx.taskId, body: "directo" })),
  );

  await check("no existe forma de responder un comentario (no hay parent_comment_id)", async () => {
    await expectError(
      member.client.from("task_comments").update({ parent_comment_id: ctx.memberComment }).eq("id", ctx.memberComment),
      "parent_comment_id",
    );
    const [row] = await ok(member.client.from("task_comments").select("*").eq("id", ctx.memberComment));
    assert(!("parent_comment_id" in row), "la columna existe");
  });

  await check("el ajeno no lee ni crea comentarios", async () => {
    const rows = await ok(outsider.client.from("task_comments").select("id").eq("board_id", ctx.boardId));
    assert(rows.length === 0, "el ajeno lee comentarios");
    await expectError(outsider.client.rpc("create_comment", { p_task_id: ctx.taskId, p_body: "hack" }), "no tienes acceso");
    const counts = await ok(outsider.client.rpc("task_comment_counts", { p_board_id: ctx.boardId }));
    assert(counts.length === 0, "el ajeno ve conteos");
  });

  await check("editar fija edited_at; autor, tarea y tablero son inmutables", async () => {
    const [c] = await ok(member.client.from("task_comments").update({ body: "Hola equipo (corregido)" }).eq("id", ctx.memberComment).select());
    assert(c.edited_at, "sin edited_at");
    await expectError(member.client.from("task_comments").update({ task_id: ctx.subtaskId }).eq("id", ctx.memberComment), "texto");
  });

  await check("el miembro no edita ni borra el comentario del admin; el admin sí borra el del miembro", async () => {
    const adminComment = await ok(admin.client.rpc("create_comment", { p_task_id: ctx.taskId, p_body: "Del admin" }));
    const edited = await ok(member.client.from("task_comments").update({ body: "hack" }).eq("id", adminComment.id).select());
    const deleted = await ok(member.client.from("task_comments").delete().eq("id", adminComment.id).select());
    assert(edited.length === 0 && deleted.length === 0, "el miembro modificó el comentario del admin");
    const byAdmin = await ok(admin.client.from("task_comments").update({ body: "hack" }).eq("id", ctx.memberComment).select());
    assert(byAdmin.length === 0, "el admin editó un comentario ajeno");
    const removed = await ok(admin.client.from("task_comments").delete().eq("id", ctx.memberComment).select());
    assert(removed.length === 1, "el admin no pudo borrar");
  });

  await check("conteos por tarea y personas: el autor admin aparece en board_people", async () => {
    const counts = await ok(member.client.rpc("task_comment_counts", { p_board_id: ctx.boardId }));
    const forTask = counts.find((c) => c.task_id === ctx.taskId);
    assert(forTask && Number(forTask.count) === 1, JSON.stringify(counts));
    const people = await ok(member.client.rpc("board_people", { p_board_id: ctx.boardId }));
    assert(people.some((p) => p.id === admin.id), "falta el admin");
  });

  await check("se puede borrar a un usuario que comentó (sus comentarios quedan como 'Usuario eliminado')", async () => {
    const { service } = await import("./lib.mjs");
    const tag = Math.random().toString(36).slice(2, 8);
    const { data: u } = await service.auth.admin.createUser({ email: `rls-temp-${tag}@example.com`, password: `Pw-${tag}-x1`, email_confirm: true });
    await ok(service.from("board_members").insert({ board_id: ctx.boardId, user_id: u.user.id }));
    const { anon } = await import("./lib.mjs");
    const c = anon();
    await c.auth.signInWithPassword({ email: `rls-temp-${tag}@example.com`, password: `Pw-${tag}-x1` });
    const comment = await ok(c.rpc("create_comment", { p_task_id: ctx.taskId, p_body: "Comentario de alguien que se irá" }));
    const { error } = await service.auth.admin.deleteUser(u.user.id);
    assert(!error, `no se pudo borrar: ${error?.message}`);
    const [row] = await ok(member.client.from("task_comments").select("author_id").eq("id", comment.id));
    assert(row && row.author_id === null, JSON.stringify(row));
  });
}
