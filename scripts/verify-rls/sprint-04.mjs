// Sprint 4: detalle de tarea, subtareas, recordatorio y personas del tablero.
import { assert, check, expectError, ok } from "./lib.mjs";

export default async function sprint4(ctx) {
  const { admin, member, outsider } = ctx;

  await check("board_people: el miembro ve su nombre y el de los admins", async () => {
    const people = await ok(member.client.rpc("board_people", { p_board_id: ctx.boardId }));
    const ids = people.map((p) => p.id);
    assert(ids.includes(member.id) && ids.includes(admin.id), JSON.stringify(people.map((p) => p.email)));
    assert(!ids.includes(outsider.id), "aparece un ajeno");
    assert(people.every((p) => Object.keys(p).sort().join() === "email,full_name,id,role"), "expone columnas de más");
  });

  await check("board_people: un ajeno no obtiene a nadie de un tablero ajeno", async () => {
    const people = await ok(outsider.client.rpc("board_people", { p_board_id: ctx.boardId }));
    assert(people.length === 0, `obtuvo ${people.length} personas`);
  });

  await check("el ajeno no puede crear subtareas en tareas de otro tablero", () =>
    expectError(outsider.client.from("tasks").insert({ board_id: ctx.boardId, parent_id: ctx.taskId, title: "x", position: "a9" })),
  );

  await check("el ajeno no puede editar ni borrar tareas ajenas (0 filas)", async () => {
    const upd = await ok(outsider.client.from("tasks").update({ title: "hack" }).eq("id", ctx.taskId).select());
    const del = await ok(outsider.client.from("tasks").delete().eq("id", ctx.taskId).select());
    assert(upd.length === 0 && del.length === 0, "el ajeno modificó una tarea");
  });

  await check("el recordatorio (Beta) se guarda y se puede quitar", async () => {
    const when = new Date(Date.now() + 86400000).toISOString();
    const [t] = await ok(member.client.from("tasks").update({ reminder_at: when }).eq("id", ctx.taskId).select());
    assert(new Date(t.reminder_at).getTime() === new Date(when).getTime(), "no se guardó reminder_at");
    const [t2] = await ok(member.client.from("tasks").update({ reminder_at: null }).eq("id", ctx.taskId).select());
    assert(t2.reminder_at === null, "no se quitó");
  });

  await check("borrar una tarea borra sus subtareas en cascada", async () => {
    const [task] = await ok(
      member.client.from("tasks").insert({ board_id: ctx.boardId, section_id: ctx.sections[1].id, title: "Padre", position: "a0" }).select(),
    );
    await ok(member.client.from("tasks").insert({ board_id: ctx.boardId, parent_id: task.id, title: "Hija", position: "a0" }));
    await ok(member.client.from("tasks").delete().eq("id", task.id));
    const left = await ok(member.client.from("tasks").select("id").eq("parent_id", task.id));
    assert(left.length === 0, "quedaron subtareas huérfanas");
  });
}
