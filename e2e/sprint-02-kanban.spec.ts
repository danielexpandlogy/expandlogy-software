import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { addTaskViaForm, createBoardFor, login, waitForWrite } from "./support/identities";

test.describe.configure({ mode: "serial" });

const column = (page: Page, name: string) => page.getByRole("region", { name: `Sección ${name}` });
const card = (scope: Page | Locator, title: string) => scope.getByRole("button", { name: `Abrir tarea: ${title}` });

/** Arrastre real con ratón, en pasos, para que dnd-kit detecte el movimiento. */
async function drag(page: Page, from: Locator, to: Locator, opts: { offsetY?: number } = {}) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2, { steps: 5 });
  await page.mouse.move(b.x + b.width / 2, b.y + (opts.offsetY ?? b.height / 2), { steps: 20 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

test.beforeAll(async ({ team }) => {
  const boardId = await createBoardFor(team.admin, team.member, "Kanban e2e");
  team.member.boardUrl = `/todos/${boardId}`;
});

test.beforeEach(async ({ page, team }) => {
  await login(page, team.member);
  await page.goto(team.member.boardUrl!);
  await expect(page.getByTestId("kanban")).toBeVisible();
});

test("'Añadir tarea' de una columna abre el formulario en esa sección y la tarea va al final", async ({ page }) => {
  const todo = column(page, "Por hacer");
  for (const t of ["Uno", "Dos", "Tres"]) await addTaskViaForm(page, todo, t);
  await expect(todo.getByRole("listitem")).toHaveText([/Uno/, /Dos/, /Tres/]);

  await page.reload();
  await expect(column(page, "Por hacer").getByRole("listitem")).toHaveText([/Uno/, /Dos/, /Tres/]);
});

test("arrastrar con ratón una tarjeta a otra columna persiste", async ({ page }) => {
  const saved = waitForWrite(page, "tasks", "PATCH");
  await drag(page, card(page, "Uno"), column(page, "En progreso"));
  await saved;
  await expect(card(column(page, "En progreso"), "Uno")).toBeVisible();

  await page.reload();
  await expect(card(column(page, "En progreso"), "Uno")).toBeVisible();
  await expect(card(column(page, "Por hacer"), "Uno")).toHaveCount(0);
});

test("reordenar dentro de la misma columna persiste", async ({ page }) => {
  // "Tres" arriba de "Dos".
  const saved = waitForWrite(page, "tasks", "PATCH");
  await drag(page, card(page, "Tres"), card(page, "Dos"), { offsetY: 4 });
  await saved;
  await page.reload();
  await expect(column(page, "Por hacer").getByRole("listitem")).toHaveText([/Tres/, /Dos/]);
});

test("mover con teclado: Espacio levanta, flechas mueven, Espacio suelta", async ({ page }) => {
  await card(page, "Dos").focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(250);
  const saved = waitForWrite(page, "tasks", "PATCH");
  await page.keyboard.press("Space");
  await saved;
  await expect(card(column(page, "En progreso"), "Dos")).toBeVisible();
  await expect(page.getByRole("status").or(page.locator("[id^=DndLiveRegion]"))).toContainText(/Soltaste la tarea Dos/);

  await page.reload();
  await expect(card(column(page, "En progreso"), "Dos")).toBeVisible();
});

test("reordenar columnas arrastrando su asa", async ({ page }) => {
  const saved = waitForWrite(page, "sections", "PATCH");
  await drag(page, page.getByRole("button", { name: "Mover sección Listo" }), page.getByRole("button", { name: "Mover sección Por hacer" }));
  await saved;
  await page.reload();
  const headings = page.locator("[data-testid=kanban] section h3");
  await expect(headings).toHaveCount(3);
  await expect(headings).toHaveText([/^Listo/, /^Por hacer/, /^En progreso/]);
});

test("crear, renombrar y eliminar una sección (con confirmación si tiene tareas)", async ({ page }) => {
  await page.getByRole("button", { name: "Añadir sección" }).click();
  const saved = waitForWrite(page, "sections");
  await page.getByPlaceholder("Nombre de la sección").fill("Bloqueado");
  await page.keyboard.press("Enter");
  await saved;
  await expect(column(page, "Bloqueado")).toBeVisible();

  await page.getByRole("button", { name: "Opciones de la sección Bloqueado" }).click();
  await page.getByRole("menuitem", { name: "Renombrar" }).click();
  await page.getByLabel("Nombre de la sección").fill("En espera");
  const renamed = waitForWrite(page, "sections", "PATCH");
  await page.keyboard.press("Enter");
  await renamed;
  await expect(column(page, "En espera")).toBeVisible();

  await addTaskViaForm(page, column(page, "En espera"), "Tarea en espera");

  await page.getByRole("button", { name: "Opciones de la sección En espera" }).click();
  await page.getByRole("menuitem", { name: "Eliminar sección" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Se eliminarán también sus 1 tarea");
  const deleted = waitForWrite(page, "sections", "DELETE");
  await dialog.getByRole("button", { name: "Eliminar" }).click();
  await deleted;
  await page.reload();
  await expect(column(page, "En espera")).toHaveCount(0);
  await expect(page.getByText("Tarea en espera")).toHaveCount(0);
});

test("las completadas se ocultan y 'Mostrar completadas' las vuelve a mostrar", async ({ page }) => {
  const saved = waitForWrite(page, "tasks", "PATCH");
  await page.getByRole("listitem").filter({ has: card(page, "Tres") }).getByRole("checkbox").click();
  await saved;
  await expect(card(page, "Tres")).toHaveCount(0);

  await page.getByLabel("Mostrar completadas").click();
  await expect(card(page, "Tres")).toBeVisible();
  await page.reload();
  await expect(card(page, "Tres")).toBeVisible(); // la preferencia se recuerda
  await page.getByLabel("Mostrar completadas").click();
  await expect(card(page, "Tres")).toHaveCount(0);
});

test("un clic abre la tarea (sin arrastrar)", async ({ page }) => {
  await card(page, "Uno").click();
  await expect(page).toHaveURL(/\/t\/[0-9a-f-]{36}/);
});
