// Sprint 6: adjuntos (Storage privado + create_comment con adjuntos).
import { randomUUID } from "node:crypto";
import { assert, check, expectError, ok, service } from "./lib.mjs";

// PNG de 1×1 válido.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const bucket = (client) => client.storage.from("task-attachments");

export default async function sprint6(ctx) {
  const { admin, member, outsider } = ctx;
  const prefix = `${ctx.boardId}/${ctx.taskId}`;
  const up = (client, path, type = "image/png") => bucket(client).upload(path, PNG, { contentType: type, upsert: false });

  await check("el miembro sube una imagen a una tarea de su tablero", async () => {
    ctx.img = `${prefix}/${randomUUID()}.png`;
    await ok(up(member.client, ctx.img));
  });

  await check("el ajeno no puede subir al tablero del miembro", () => expectError(up(outsider.client, `${prefix}/${randomUUID()}.png`)));

  await check("no se puede subir a una tarea de otro tablero ni con rutas raras", async () => {
    await expectError(up(member.client, `${ctx.boardId}/${randomUUID()}/${randomUUID()}.png`)); // tarea inexistente
    await expectError(up(member.client, `${prefix}/sub/${randomUUID()}.png`)); // 4 segmentos
    await expectError(up(member.client, `no-es-uuid/${ctx.taskId}/${randomUUID()}.png`));
  });

  await check("tipos no permitidos por el bucket se rechazan", () =>
    expectError(up(member.client, `${prefix}/${randomUUID()}.html`, "text/html")),
  );

  await check("el ajeno no obtiene URL firmada; el miembro y el admin sí", async () => {
    const o = await outsider.client.storage.from("task-attachments").createSignedUrl(ctx.img, 60);
    assert(o.error || !o.data?.signedUrl, "el ajeno obtuvo URL firmada");
    await ok(bucket(member.client).createSignedUrl(ctx.img, 60));
    await ok(bucket(admin.client).createSignedUrl(ctx.img, 60));
  });

  await check("comentario sólo con adjunto: tipo y tamaño salen del servidor", async () => {
    const c = await ok(
      member.client.rpc("create_comment", {
        p_task_id: ctx.taskId,
        p_body: "",
        p_attachments: [{ storage_path: ctx.img, kind: "image", width: 1, height: 1 }],
      }),
    );
    const [att] = await ok(member.client.from("comment_attachments").select("*").eq("comment_id", c.id));
    assert(att.mime_type === "image/png" && Number(att.size_bytes) === PNG.length && att.board_id === ctx.boardId, JSON.stringify(att));
    ctx.attComment = c.id;
  });

  await check("no se puede reutilizar un archivo ya adjunto", () =>
    expectError(
      member.client.rpc("create_comment", { p_task_id: ctx.taskId, p_body: "x", p_attachments: [{ storage_path: ctx.img, kind: "image" }] }),
      "ya está adjunto",
    ),
  );

  await check("create_comment rechaza archivos de otra persona, de otra tarea o con tipo falso", async () => {
    const adminFile = `${prefix}/${randomUUID()}.png`;
    await ok(up(admin.client, adminFile));
    await expectError(
      member.client.rpc("create_comment", { p_task_id: ctx.taskId, p_body: "x", p_attachments: [{ storage_path: adminFile, kind: "image" }] }),
      "no lo subiste",
    );
    const mine = `${prefix}/${randomUUID()}.png`;
    await ok(up(member.client, mine));
    await expectError(
      member.client.rpc("create_comment", { p_task_id: ctx.subtaskId, p_body: "x", p_attachments: [{ storage_path: mine, kind: "image" }] }),
      "Ruta",
    );
    await expectError(
      member.client.rpc("create_comment", { p_task_id: ctx.taskId, p_body: "x", p_attachments: [{ storage_path: mine, kind: "audio" }] }),
      "tipo",
    );
    ctx.adminFile = adminFile;
    ctx.spare = mine;
  });

  await check("máximo 10 adjuntos por comentario", () =>
    expectError(
      member.client.rpc("create_comment", {
        p_task_id: ctx.taskId,
        p_body: "x",
        p_attachments: Array.from({ length: 11 }, () => ({ storage_path: ctx.spare, kind: "image" })),
      }),
      "Máximo 10",
    ),
  );

  await check("borrar archivos: el miembro no borra el del admin; el admin sí borra el del miembro", async () => {
    const r1 = await bucket(member.client).remove([ctx.adminFile]);
    const still = await service.storage.from("task-attachments").list(prefix, { search: ctx.adminFile.split("/")[2] });
    assert(!r1.error && still.data?.length === 1, "el miembro borró el archivo del admin");
    const r2 = await bucket(admin.client).remove([ctx.spare]);
    assert(!r2.error && r2.data?.length === 1, "el admin no pudo borrar");
  });

  await check("el ajeno no ve filas de adjuntos; attachment_orphans es sólo del service role", async () => {
    const rows = await ok(outsider.client.from("comment_attachments").select("id").eq("board_id", ctx.boardId));
    assert(rows.length === 0, "el ajeno ve adjuntos");
    await expectError(member.client.rpc("attachment_orphans", { p_limit: 5 }));
    await ok(service.rpc("attachment_orphans", { p_limit: 5 }));
  });

  await check("borrar el comentario borra la fila del adjunto en cascada", async () => {
    await ok(member.client.from("task_comments").delete().eq("id", ctx.attComment));
    const rows = await ok(service.from("comment_attachments").select("id").eq("comment_id", ctx.attComment));
    assert(rows.length === 0, "quedó la fila del adjunto");
    await bucket(member.client).remove([ctx.img]);
    await bucket(admin.client).remove([ctx.adminFile]);
  });
}
