// Sprint 7: Realtime respeta la RLS (un ajeno no recibe cambios de un tablero ajeno).
import { assert, check, ok } from "./lib.mjs";

function listen(client, boardId) {
  const events = [];
  return new Promise((resolve, reject) => {
    const channel = client
      .channel(`verify:${boardId}:${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `board_id=eq.${boardId}` }, (p) => events.push(p))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_comments", filter: `board_id=eq.${boardId}` }, (p) => events.push(p))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") resolve({ events, stop: () => client.removeChannel(channel) });
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(`realtime: ${status}`));
      });
  });
}

export default async function sprint7(ctx) {
  const { member, outsider } = ctx;

  await check("el miembro recibe en vivo; el ajeno suscrito al mismo tablero no recibe nada", async () => {
    // El socket usa el JWT de cada identidad para aplicar la RLS.
    for (const who of [member, outsider]) {
      const { data } = await who.client.auth.getSession();
      who.client.realtime.setAuth(data.session.access_token);
    }
    const mine = await listen(member.client, ctx.boardId);
    const theirs = await listen(outsider.client, ctx.boardId);
    await ok(member.client.from("tasks").insert({ board_id: ctx.boardId, section_id: ctx.sections[0].id, title: "En vivo", position: "z0" }));
    await ok(member.client.rpc("create_comment", { p_task_id: ctx.taskId, p_body: "Comentario en vivo" }));
    await new Promise((r) => setTimeout(r, 4000));
    await mine.stop();
    await theirs.stop();
    assert(mine.events.some((e) => e.table === "tasks" && e.new.title === "En vivo"), `el miembro recibió ${mine.events.length} eventos`);
    assert(mine.events.some((e) => e.table === "task_comments"), "el miembro no recibió el comentario");
    assert(theirs.events.length === 0, `el ajeno recibió ${theirs.events.length} eventos`);
  });
}
