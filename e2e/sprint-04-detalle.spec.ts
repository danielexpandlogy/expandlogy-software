import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { createBoardFor, login, settleAnimations, waitForWrite } from "./support/identities";

test.describe.configure({ mode: "serial" });

let boardUrl: string;
let taskUrl: string;
const card = (page: Page, title: string) => page.getByRole("button", { name: `Abrir tarea: ${title}` });
const sheet = (page: Page) => page.getByRole("dialog");

test.beforeAll(async ({ team }) => {
  const boardId = await createBoardFor(team.admin, team.member, "Detalle e2e");
  boardUrl = `/todos/${boardId}?vista=kanban`;
  const { data: sections } = await team.member.client.from("sections").select("*").eq("board_id", boardId).order("position");
  const { data } = await team.member.client
    .from("tasks")
    .insert({ board_id: boardId, section_id: sections![0].id, title: "Llamar a proveedor", position: "a0" })
    .select()
    .single();
  taskUrl = `/todos/${boardId}/t/${data!.id}`;
});

test.beforeEach(async ({ page, team }) => {
  await login(page, team.member);
});

test("clic en la tarjeta abre el panel con URL propia; Esc lo cierra conservando la vista", async ({ page }) => {
  await page.goto(boardUrl);
  await card(page, "Llamar a proveedor").click();
  await expect(page).toHaveURL(/\/t\/[0-9a-f-]{36}\?vista=kanban$/);
  await expect(sheet(page).getByLabel("Título de la tarea")).toHaveValue("Llamar a proveedor");
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/todos\/[0-9a-f-]{36}\?vista=kanban$/);
});

test("editar título y descripción se guarda solo (y Esc en un campo no cierra el panel)", async ({ page }) => {
  await page.goto(taskUrl);
  const title = sheet(page).getByLabel("Título de la tarea");
  await title.fill("Llamar a proveedor de cajas");
  const saved = waitForWrite(page, "tasks", "PATCH");
  await title.press("Enter");
  await saved;

  const desc = sheet(page).getByLabel("Descripción");
  await desc.click();
  await desc.fill("Pedir cotización\nde 500 cajas");
  await expect(sheet(page).getByText("Guardado")).toBeVisible();
  await desc.press("Escape");
  await expect(sheet(page)).toBeVisible();

  await page.reload();
  await expect(sheet(page).getByLabel("Título de la tarea")).toHaveValue("Llamar a proveedor de cajas");
  await expect(sheet(page).getByLabel("Descripción")).toHaveValue("Pedir cotización\nde 500 cajas");
});

test("cerrar justo después de escribir no pierde la descripción", async ({ page }) => {
  await page.goto(taskUrl);
  const desc = sheet(page).getByLabel("Descripción");
  await desc.fill("Texto escrito y cerrado al instante");
  const saved = waitForWrite(page, "tasks", "PATCH");
  await sheet(page).getByRole("button", { name: "Cerrar" }).click();
  await saved;
  await page.goto(taskUrl);
  await expect(sheet(page).getByLabel("Descripción")).toHaveValue("Texto escrito y cerrado al instante");
});

test("recordatorio Beta: se explica, se guarda y aparece en la tarjeta", async ({ page }) => {
  await page.goto(taskUrl);
  await sheet(page).getByRole("button", { name: "Recordatorio (Beta)" }).click();
  const popover = page.getByRole("dialog").last();
  await expect(popover.getByText("Beta", { exact: true }).first()).toBeVisible();
  await expect(popover).toContainText("todavía no envía notificaciones");
  const saved = waitForWrite(page, "tasks", "PATCH");
  await popover.getByRole("button", { name: /^Mañana, 9:00/ }).click();
  await saved;
  await page.keyboard.press("Escape");
  await page.goto(boardUrl);
  await expect(card(page, "Llamar a proveedor de cajas").getByTitle("Recordatorio (Beta)")).toContainText("09:00");
});

test("subtareas: crear encadenadas, completar una y ver el progreso en la tarjeta", async ({ page }) => {
  await page.goto(taskUrl);
  await sheet(page).getByRole("button", { name: "Añadir subtarea" }).click();
  const input = sheet(page).getByPlaceholder("Nombre de la subtarea");
  for (const t of ["Pedir cotización", "Comparar precios", "Confirmar pedido"]) {
    const saved = waitForWrite(page, "tasks");
    await input.fill(t);
    await input.press("Enter");
    await saved;
  }
  await expect(sheet(page).getByRole("button", { name: /^Abrir subtarea/ })).toHaveCount(3);
  const done = waitForWrite(page, "tasks", "PATCH");
  await sheet(page).getByRole("listitem").filter({ hasText: "Pedir cotización" }).getByRole("checkbox").click();
  await done;
  await expect(sheet(page).getByRole("heading", { name: /Subtareas/ })).toContainText("1/3");

  await page.goto(boardUrl);
  await expect(card(page, "Llamar a proveedor de cajas").getByLabel("1 de 3 subtareas completadas")).toBeVisible();
});

test("una subtarea se abre en el mismo panel, sin opción de sub-subtareas, y vuelve a su padre", async ({ page }) => {
  await page.goto(taskUrl);
  await sheet(page).getByRole("button", { name: "Abrir subtarea: Comparar precios" }).click();
  await expect(sheet(page).getByLabel("Título de la tarea")).toHaveValue("Comparar precios");
  await expect(sheet(page).getByRole("button", { name: "Añadir subtarea" })).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Llamar a proveedor de cajas" }).click();
  await expect(sheet(page).getByLabel("Título de la tarea")).toHaveValue("Llamar a proveedor de cajas");
});

test("vista lista: las subtareas se despliegan sangradas y se completan desde ahí", async ({ page }) => {
  await page.goto(boardUrl.replace("kanban", "lista"));
  await page.getByRole("button", { name: "Mostrar subtareas de Llamar a proveedor de cajas" }).click();
  const subs = page.getByRole("list", { name: "Subtareas de Llamar a proveedor de cajas" });
  await expect(subs.getByRole("listitem")).toHaveText([/Comparar precios/, /Confirmar pedido/]); // la completada se oculta
  const saved = waitForWrite(page, "tasks", "PATCH");
  await subs.getByRole("listitem").filter({ hasText: "Confirmar pedido" }).getByRole("checkbox").click();
  await saved;
  await expect(page.getByLabel("2 de 3 subtareas completadas")).toBeVisible();
});

test("reordenar subtareas arrastrando dentro del panel", async ({ page }) => {
  await page.goto(taskUrl);
  const rows = sheet(page).getByRole("button", { name: /^Abrir subtarea/ });
  await expect(rows).toHaveText([/Pedir cotización/, /Comparar precios/, /Confirmar pedido/]);
  await settleAnimations(page);
  const from = (await sheet(page).getByRole("button", { name: "Mover subtarea Confirmar pedido" }).boundingBox())!;
  const to = (await sheet(page).getByRole("button", { name: "Mover subtarea Pedir cotización" }).boundingBox())!;
  const saved = waitForWrite(page, "tasks", "PATCH");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y - 10, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 2, { steps: 15 });
  await page.mouse.up();
  await saved;
  await page.reload();
  await expect(sheet(page).getByRole("button", { name: /^Abrir subtarea/ })).toHaveText([
    /Confirmar pedido/,
    /Pedir cotización/,
    /Comparar precios/,
  ]);
});

test("eliminar la tarea (con confirmación) borra también sus subtareas", async ({ page, team }) => {
  await page.goto(taskUrl);
  await sheet(page).getByRole("button", { name: "Eliminar tarea" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("3 subtareas");
  const deleted = waitForWrite(page, "tasks", "DELETE");
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
  await deleted;
  await expect(page.getByText("La tarea ya no existe")).toHaveCount(0);
  await expect(card(page, "Llamar a proveedor de cajas")).toHaveCount(0);
  const boardId = boardUrl.split("/")[2].split("?")[0];
  const { data } = await team.member.client.from("tasks").select("id").eq("board_id", boardId);
  expect(data).toHaveLength(0);
});
