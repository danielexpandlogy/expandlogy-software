import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { createBoardFor, login, waitForWrite } from "./support/identities";

test.describe.configure({ mode: "serial" });

const section = (page: Page, name: string) => page.getByRole("region", { name: `Sección ${name}` });
const item = (scope: Page | Locator, title: string) => scope.getByRole("button", { name: `Abrir tarea: ${title}` });

async function drag(page: Page, from: Locator, to: Locator, offsetY?: number) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  // Filas: agarrar a la izquierda (lejos del checkbox); asas pequeñas: al centro.
  const ax = a.x + Math.min(40, a.width / 2);
  const bx = b.x + Math.min(40, b.width / 2);
  await page.mouse.move(ax, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(ax + 10, a.y + a.height / 2, { steps: 5 });
  await page.mouse.move(bx, b.y + (offsetY ?? b.height / 2), { steps: 20 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

let boardUrl: string;

test.beforeAll(async ({ team }) => {
  const boardId = await createBoardFor(team.admin, team.member, "Lista e2e");
  boardUrl = `/todos/${boardId}`;
  const { data: sections } = await team.member.client.from("sections").select("*").eq("board_id", boardId).order("position");
  const rows = [
    ["Alfa", 0, "a0"],
    ["Beta", 0, "a1"],
    ["Gamma", 1, "a0"],
    ["Delta", 2, "a0"],
  ] as const;
  for (const [title, s, position] of rows) {
    await team.member.client.from("tasks").insert({ board_id: boardId, section_id: sections![s].id, title, position });
  }
});

test.beforeEach(async ({ page, team }) => {
  await login(page, team.member);
});

test("cambiar a lista actualiza la URL y muestra las secciones como grupos", async ({ page }) => {
  await page.goto(boardUrl);
  await expect(page.getByTestId("kanban")).toBeVisible();
  await page.getByRole("radio", { name: "Lista" }).click();
  await expect(page).toHaveURL(/vista=lista/);
  await expect(page.getByTestId("list-view")).toBeVisible();
  await expect(section(page, "Por hacer").getByRole("listitem")).toHaveText([/Alfa/, /Beta/]);
  // Sin recargar datos: ambas vistas leen la misma caché.
  await page.getByRole("radio", { name: "Kanban" }).click();
  await expect(page.getByTestId("kanban")).toBeVisible();
  await page.getByRole("radio", { name: "Lista" }).click();
  await expect(page.getByRole("radio", { name: "Lista" })).toBeFocused();

  // La vista elegida se recuerda aunque la URL no traiga ?vista.
  await page.goto(boardUrl);
  await expect(page.getByTestId("list-view")).toBeVisible();
});

test("arrastrar una fila a otra sección y verla en kanban", async ({ page }) => {
  await page.goto(`${boardUrl}?vista=lista`);
  const saved = waitForWrite(page, "tasks", "PATCH");
  await drag(page, item(page, "Beta"), item(section(page, "En progreso"), "Gamma"), 4);
  await saved;
  await expect(section(page, "En progreso").getByRole("listitem")).toHaveText([/Beta/, /Gamma/]);
  await page.getByRole("radio", { name: "Kanban" }).click();
  await expect(item(section(page, "En progreso"), "Beta")).toBeVisible();
  await page.reload();
  await expect(section(page, "En progreso").getByRole("listitem")).toHaveText([/Beta/, /Gamma/]);
});

test("colapsar una sección se recuerda al recargar", async ({ page }) => {
  await page.goto(`${boardUrl}?vista=lista`);
  const toggle = section(page, "Listo").getByRole("button", { name: /^Listo/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(item(page, "Delta")).toHaveCount(0);
  await page.reload();
  await expect(section(page, "Listo").getByRole("button", { name: /^Listo/ })).toHaveAttribute("aria-expanded", "false");
});

test("soltar sobre una sección colapsada manda la tarea al final de esa sección", async ({ page }) => {
  await page.goto(`${boardUrl}?vista=lista`);
  await section(page, "Listo").getByRole("button", { name: /^Listo/ }).click(); // colapsar
  const saved = waitForWrite(page, "tasks", "PATCH");
  await drag(page, item(page, "Alfa"), section(page, "Listo").locator("header"));
  await saved;
  await section(page, "Listo").getByRole("button", { name: /^Listo/ }).click(); // expandir
  await expect(section(page, "Listo").getByRole("listitem")).toHaveText([/Delta/, /Alfa/]);
});

test("teclado en lista: ↓ en el borde pasa a la sección siguiente", async ({ page }) => {
  await page.goto(`${boardUrl}?vista=lista`);
  // En progreso: [Beta, Gamma]. Gamma ↓ → primera de Listo.
  await item(page, "Gamma").focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(250);
  const saved = waitForWrite(page, "tasks", "PATCH");
  await page.keyboard.press("Space");
  await saved;
  await expect(section(page, "Listo").getByRole("listitem").first()).toHaveText(/Gamma/);
  await page.reload();
  await expect(section(page, "Listo").getByRole("listitem")).toHaveText([/Gamma/, /Delta/, /Alfa/]);
});

test("reordenar secciones en la lista", async ({ page }) => {
  await page.goto(`${boardUrl}?vista=lista`);
  const saved = waitForWrite(page, "sections", "PATCH");
  await drag(page, page.getByRole("button", { name: "Mover sección Listo" }), page.getByRole("button", { name: "Mover sección Por hacer" }), 2);
  await saved;
  await page.reload();
  const titles = page.locator("[data-testid=list-view] section h3");
  await expect(titles).toHaveCount(3);
  await expect(titles).toHaveText([/^Listo/, /^Por hacer/, /^En progreso/]);
});

test("móvil: la primera vez la vista por defecto es lista y no hay scroll horizontal", async ({ browser, team }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await login(page, team.member);
  await page.goto(boardUrl);
  await expect(page.getByTestId("list-view")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await ctx.close();
});
