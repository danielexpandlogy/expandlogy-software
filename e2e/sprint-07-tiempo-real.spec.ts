import type { Browser, Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { addTaskViaForm, createBoardFor, login, setView, waitForWrite, type Identity } from "./support/identities";

test.describe.configure({ mode: "serial" });

let boardId: string;
let taskId: string;
const column = (page: Page, name: string) => page.getByRole("region", { name: `Sección ${name}` });
const card = (scope: Page | ReturnType<Page["locator"]>, title: string) =>
  scope.getByRole("button", { name: `Abrir tarea: ${title}` });

async function open(browser: Browser, who: Identity, path: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, who);
  await page.goto(path);
  return { ctx, page };
}

test.beforeAll(async ({ team }) => {
  boardId = await createBoardFor(team.admin, team.member, "En vivo e2e");
  const { data: sections } = await team.member.client.from("sections").select("*").eq("board_id", boardId).order("position");
  const { data } = await team.member.client
    .from("tasks")
    .insert({ board_id: boardId, section_id: sections![0].id, title: "Tarea compartida", position: "a0" })
    .select()
    .single();
  taskId = data!.id;
});

test("lo que crea y mueve una persona aparece en la pantalla de la otra sin recargar", async ({ browser, team }) => {
  const ana = await open(browser, team.member, `/todos/${boardId}?vista=kanban`);
  const daniel = await open(browser, team.admin, `/todos/${boardId}?vista=kanban`);
  await expect(card(daniel.page, "Tarea compartida")).toBeVisible();
  await daniel.page.waitForTimeout(1500); // canal suscrito

  await addTaskViaForm(ana.page, column(ana.page, "Por hacer"), "Creada por Ana");
  await expect(card(column(daniel.page, "Por hacer"), "Creada por Ana")).toBeVisible({ timeout: 5000 });

  await card(ana.page, "Tarea compartida").focus();
  await ana.page.keyboard.press("Space");
  await ana.page.waitForTimeout(150);
  await ana.page.keyboard.press("ArrowRight");
  await ana.page.waitForTimeout(250);
  const moved = waitForWrite(ana.page, "tasks", "PATCH");
  await ana.page.keyboard.press("Space");
  await moved;
  await expect(card(column(daniel.page, "En progreso"), "Tarea compartida")).toBeVisible({ timeout: 5000 });

  await ana.ctx.close();
  await daniel.ctx.close();
});

test("un comentario nuevo aparece en el panel abierto de la otra persona", async ({ browser, team }) => {
  const ana = await open(browser, team.member, `/todos/${boardId}/t/${taskId}?vista=kanban`);
  await expect(ana.page.getByText("Aún no hay comentarios.")).toBeVisible();
  await ana.page.waitForTimeout(1500);
  const { error } = await team.admin.client.rpc("create_comment", { p_task_id: taskId, p_body: "Hola Ana, ¿cómo va?" });
  expect(error).toBeNull();
  await expect(ana.page.getByRole("article").filter({ hasText: "Hola Ana, ¿cómo va?" })).toBeVisible({ timeout: 5000 });
  await ana.page.keyboard.press("Escape");
  await expect(card(ana.page, "Tarea compartida").getByLabel("1 comentarios")).toBeVisible({ timeout: 5000 });
  await ana.ctx.close();
});

test("si otra persona borra la tarea abierta, el panel se cierra y lo avisa", async ({ browser, team }) => {
  const { data: sections } = await team.member.client.from("sections").select("id").eq("board_id", boardId).order("position");
  const { data: doomed } = await team.member.client
    .from("tasks")
    .insert({ board_id: boardId, section_id: sections![0].id, title: "Se va a borrar", position: "a5" })
    .select()
    .single();
  const ana = await open(browser, team.member, `/todos/${boardId}/t/${doomed!.id}?vista=kanban`);
  await expect(ana.page.getByRole("dialog").getByLabel("Título de la tarea")).toHaveValue("Se va a borrar");
  await ana.page.waitForTimeout(1500);
  await team.admin.client.from("tasks").delete().eq("id", doomed!.id);
  await expect(ana.page.getByText("Esta tarea fue eliminada")).toBeVisible({ timeout: 5000 });
  await expect(ana.page.getByRole("dialog")).toHaveCount(0);
  await ana.ctx.close();
});

test("sin conexión se avisa; al volver, el tablero se resincroniza solo", async ({ browser, team }) => {
  const ana = await open(browser, team.member, `/todos/${boardId}?vista=kanban`);
  await expect(card(ana.page, "Tarea compartida")).toBeVisible();
  await ana.page.waitForTimeout(1500);
  await ana.ctx.setOffline(true);
  await expect(ana.page.getByRole("status").filter({ hasText: "Sin conexión, reintentando…" })).toBeVisible();

  const { data: sections } = await team.admin.client.from("sections").select("id").eq("board_id", boardId).order("position");
  await team.admin.client.from("tasks").insert({ board_id: boardId, section_id: sections![2].id, title: "Creada sin Ana", position: "a0" });

  await ana.ctx.setOffline(false);
  await expect(card(column(ana.page, "Listo"), "Creada sin Ana")).toBeVisible({ timeout: 20_000 });
  await expect(ana.page.getByText("Sin conexión, reintentando…")).toHaveCount(0, { timeout: 20_000 });
  await ana.ctx.close();
});

test("buscar en el tablero filtra en ambas vistas (y conserva la tarea si coincide una subtarea)", async ({ page, team }) => {
  await team.member.client.from("tasks").insert({ board_id: boardId, parent_id: taskId, title: "Revisar factura 881", position: "a0" });
  await login(page, team.member);
  await page.goto(`/todos/${boardId}?vista=kanban`);
  await page.getByLabel("Buscar en el tablero").fill("factura");
  await expect(card(page, "Tarea compartida")).toBeVisible();
  await expect(card(page, "Creada por Ana")).toHaveCount(0);
  await setView(page, "Lista");
  await expect(card(page, "Tarea compartida")).toBeVisible();
  await expect(card(page, "Creada por Ana")).toHaveCount(0);
  await page.getByLabel("Buscar en el tablero").fill("no existe nada así");
  await expect(page.getByText("Ninguna tarea coincide")).toBeVisible();
});
