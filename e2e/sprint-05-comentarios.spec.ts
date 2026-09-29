import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { createBoardFor, login } from "./support/identities";

test.describe.configure({ mode: "serial" });

let boardId: string;
let taskUrl: string;
let subtaskUrl: string;
const panel = (page: Page) => page.getByRole("dialog");
const comment = (page: Page, text: string) => panel(page).getByRole("article").filter({ hasText: text });

async function send(page: Page, text: string) {
  const done = page.waitForResponse((r) => r.url().includes("/rpc/create_comment") && r.ok());
  await panel(page).getByLabel("Escribe un comentario").fill(text);
  await panel(page).getByLabel("Escribe un comentario").press("Enter");
  await done;
}

test.beforeAll(async ({ team }) => {
  boardId = await createBoardFor(team.admin, team.member, "Comentarios e2e");
  const { data: sections } = await team.member.client.from("sections").select("*").eq("board_id", boardId).order("position");
  const { data: task } = await team.member.client
    .from("tasks")
    .insert({ board_id: boardId, section_id: sections![0].id, title: "Llamar a proveedor", position: "a0" })
    .select()
    .single();
  const { data: sub } = await team.member.client
    .from("tasks")
    .insert({ board_id: boardId, parent_id: task!.id, title: "Pedir cotización", position: "a0" })
    .select()
    .single();
  taskUrl = `/todos/${boardId}/t/${task!.id}?vista=kanban`;
  subtaskUrl = `/todos/${boardId}/t/${sub!.id}?vista=kanban`;
});

test("el miembro comenta; aparece con su nombre y 'hace un momento'; Shift+Enter hace salto de línea", async ({ page, team }) => {
  await login(page, team.member);
  await page.goto(taskUrl);
  const box = panel(page).getByLabel("Escribe un comentario");
  await box.fill("Ya le dejé mensaje");
  await box.press("Shift+Enter");
  await box.pressSequentially("mañana llamo de nuevo");
  const done = page.waitForResponse((r) => r.url().includes("/rpc/create_comment") && r.ok());
  await box.press("Enter");
  await done;
  const c = comment(page, "Ya le dejé mensaje");
  await expect(c).toContainText(team.member.name);
  await expect(c).toContainText("hace un momento");
  await expect(c.locator("p")).toHaveText("Ya le dejé mensaje\nmañana llamo de nuevo");
  await expect(box).toHaveValue("");
});

test("el admin ve el comentario y responde en la misma lista (orden cronológico, sin 'Responder')", async ({ page, team }) => {
  await login(page, team.admin);
  await page.goto(taskUrl);
  await expect(comment(page, "Ya le dejé mensaje")).toBeVisible();
  await send(page, "Perfecto, avísame https://expandlogy.com/pedidos");
  await expect(panel(page).getByRole("article")).toHaveText([/Ya le dejé mensaje/, /Perfecto, avísame/]);
  await expect(comment(page, "Perfecto").getByRole("link", { name: "https://expandlogy.com/pedidos" })).toHaveAttribute(
    "target",
    "_blank",
  );
  await expect(panel(page).getByRole("button", { name: /responder/i })).toHaveCount(0);
});

test("el miembro edita el suyo (queda '(editado)') y no puede editar ni borrar el del admin", async ({ page, team }) => {
  await login(page, team.member);
  await page.goto(taskUrl);
  await comment(page, "Ya le dejé mensaje").getByRole("button", { name: "Opciones del comentario" }).click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  await panel(page).getByLabel("Editar comentario").fill("Ya le dejé mensaje (2 veces)");
  const saved = page.waitForResponse((r) => r.url().includes("/rest/v1/task_comments") && r.request().method() === "PATCH");
  await panel(page).getByRole("button", { name: "Guardar" }).click();
  await saved;
  await expect(comment(page, "(2 veces)")).toContainText("(editado)");
  await expect(comment(page, "Perfecto").getByRole("button", { name: "Opciones del comentario" })).toHaveCount(0);
});

test("la tarjeta muestra el conteo de comentarios", async ({ page, team }) => {
  await login(page, team.member);
  await page.goto(`/todos/${boardId}?vista=kanban`);
  await expect(page.getByRole("button", { name: "Abrir tarea: Llamar a proveedor" }).getByLabel("2 comentarios")).toBeVisible();
});

test("una subtarea tiene su propio hilo", async ({ page, team }) => {
  await login(page, team.member);
  await page.goto(subtaskUrl);
  await expect(panel(page).getByText("Aún no hay comentarios.")).toBeVisible();
  await send(page, "Cotización pedida");
  await page.goto(taskUrl);
  await expect(comment(page, "Cotización pedida")).toHaveCount(0);
});

test("el admin puede borrar el comentario del miembro (con confirmación)", async ({ page, team }) => {
  await login(page, team.admin);
  await page.goto(taskUrl);
  await comment(page, "(2 veces)").getByRole("button", { name: "Opciones del comentario" }).click();
  await expect(page.getByRole("menuitem", { name: "Editar" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  const deleted = page.waitForResponse((r) => r.url().includes("/rest/v1/task_comments") && r.request().method() === "DELETE");
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
  await deleted;
  await expect(comment(page, "(2 veces)")).toHaveCount(0);
  await page.reload();
  await expect(panel(page).getByRole("article")).toHaveText([/Perfecto/]);
});

test("si falla el envío, queda marcado 'No enviado' con Reintentar", async ({ page, team }) => {
  await login(page, team.member);
  await page.goto(taskUrl);
  await page.route("**/rpc/create_comment", (route) => route.fulfill({ status: 500, body: '{"message":"caído"}' }), { times: 1 });
  await panel(page).getByLabel("Escribe un comentario").fill("Mensaje con red caída");
  await panel(page).getByLabel("Escribe un comentario").press("Enter");
  const failed = comment(page, "Mensaje con red caída");
  await expect(failed).toContainText("No enviado");
  const done = page.waitForResponse((r) => r.url().includes("/rpc/create_comment") && r.ok());
  await failed.getByRole("button", { name: "Reintentar" }).click();
  await done;
  await expect(comment(page, "Mensaje con red caída")).not.toContainText("No enviado");
  await page.reload();
  await expect(comment(page, "Mensaje con red caída")).toBeVisible();
});

test("con más de 50 comentarios se paginan: 'Ver comentarios anteriores' trae el resto en orden", async ({ page, team }) => {
  const { data: sections } = await team.member.client.from("sections").select("*").eq("board_id", boardId).order("position");
  const { data: task } = await team.member.client
    .from("tasks")
    .insert({ board_id: boardId, section_id: sections![1].id, title: "Tarea muy comentada", position: "a0" })
    .select()
    .single();
  for (let i = 1; i <= 55; i++) {
    const { error } = await team.member.client.rpc("create_comment", { p_task_id: task!.id, p_body: `Comentario ${i}` });
    if (error) throw error;
  }
  await login(page, team.member);
  await page.goto(`/todos/${boardId}/t/${task!.id}`);
  await expect(panel(page).getByRole("article")).toHaveCount(50);
  await expect(panel(page).getByRole("article").first()).toContainText("Comentario 6");
  await panel(page).getByRole("button", { name: "Ver comentarios anteriores" }).click();
  await expect(panel(page).getByRole("article")).toHaveCount(55);
  await expect(panel(page).getByRole("article").first()).toContainText("Comentario 1");
  await expect(panel(page).getByRole("article").last()).toContainText("Comentario 55");
  await expect(panel(page).getByRole("button", { name: "Ver comentarios anteriores" })).toHaveCount(0);
});
