import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { addTaskViaForm, login, waitForWrite } from "./support/identities";

test.describe.configure({ mode: "serial" });

const sidebar = (page: Page) => page.locator("[data-sidebar=sidebar]");
let teamBoardUrl: string;

test("sin sesión, /todos y cualquier tablero redirigen a /login", async ({ page }) => {
  await page.goto("/todos");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/todos/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/login$/);
});

test("un usuario sin tableros ve el estado vacío y el Home lo invita a crear uno", async ({ page, team }) => {
  await login(page, team.member);
  await page.goto("/todos");
  await expect(page.getByText("Aún no tienes tableros")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Crea tu primer tablero" })).toBeVisible();
});

test("un usuario crea tableros personales (sin opción de equipo) y aparecen en su menú", async ({ page, team }) => {
  await login(page, team.member);
  await page.goto("/todos");
  for (const name of ["Mis pendientes", "Ideas"]) {
    await page.getByRole("button", { name: "Nuevo tablero" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Nuevo tablero" });
    await expect(dialog.getByRole("radio", { name: /De equipo/ })).toHaveCount(0);
    await dialog.getByLabel("Nombre").fill(name);
    await dialog.getByRole("button", { name: "Crear tablero" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("Tablero personal")).toBeVisible();
    await page.goto("/todos");
  }
  await expect(sidebar(page).getByRole("link", { name: "Mis pendientes" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Ideas" })).toBeVisible();

  // El dueño puede renombrar su tablero personal.
  await sidebar(page).getByRole("link", { name: "Ideas" }).click();
  await page.getByRole("button", { name: "Opciones del tablero" }).click();
  await expect(page.getByRole("menuitem", { name: "Personas del tablero" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Renombrar" }).click();
  await page.getByLabel("Nombre del tablero").fill("Ideas 2026");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Ideas 2026" })).toBeVisible();
});

test("el admin crea un tablero de equipo con varias personas", async ({ page, team }) => {
  await login(page, team.admin);
  await page.goto("/todos");
  await page.getByRole("button", { name: "Nuevo tablero" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Nuevo tablero" });
  await dialog.getByLabel("Nombre").fill("Equipo Ventas");
  await dialog.getByRole("radio", { name: /De equipo/ }).click();
  await expect(dialog.getByRole("button", { name: "Crear tablero" })).toBeDisabled(); // sin personas todavía
  for (const who of [team.member, team.outsider]) {
    await dialog.getByPlaceholder(/Buscar persona/).fill(who.email);
    await dialog.getByRole("option", { name: new RegExp(who.email) }).click();
  }
  await expect(dialog.getByRole("list", { name: "Personas seleccionadas" }).getByRole("listitem")).toHaveCount(2);
  await dialog.getByRole("button", { name: "Crear tablero" }).click();

  await expect(page).toHaveURL(/\/todos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Equipo Ventas" })).toBeVisible();
  await expect(page.getByText("Tablero de equipo · 3 personas")).toBeVisible();
  for (const s of ["Por hacer", "En progreso", "Listo"]) {
    await expect(page.getByRole("heading", { name: new RegExp(`^${s}`) })).toBeVisible();
  }
  teamBoardUrl = new URL(page.url()).pathname;
  await expect(sidebar(page).getByRole("link", { name: "Equipo Ventas" })).toBeVisible();
});

test("cada persona asignada ve el tablero de equipo en su menú y puede trabajar en él", async ({ page, team }) => {
  await login(page, team.member);
  await page.goto("/");
  await sidebar(page).getByRole("link", { name: "Equipo Ventas" }).click();
  await expect(page).toHaveURL(new RegExp(`${teamBoardUrl}$`));
  await addTaskViaForm(page, page.getByRole("region", { name: "Sección Por hacer" }), "Llamar a cliente Acme");
  // Un usuario no gestiona el tablero de equipo.
  await expect(page.getByRole("button", { name: "Opciones del tablero" })).toHaveCount(0);

  // Tarea rápida desde el Home, eligiendo el tablero.
  await page.goto("/");
  await page.getByRole("combobox", { name: "Tablero de la tarea rápida" }).click();
  await page.getByRole("option", { name: "Equipo Ventas" }).click();
  await page.getByPlaceholder("Añadir tarea rápida…").fill("Tarea desde el Home");
  const saved = waitForWrite(page, "tasks");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await saved;
  await expect(page.getByRole("link", { name: /Tarea desde el Home/ })).toBeVisible();

  await login(page, team.outsider);
  await page.goto(teamBoardUrl);
  await expect(page.getByText("Tarea desde el Home")).toBeVisible();
  await expect(page.getByText("Llamar a cliente Acme")).toBeVisible();
});

test("el admin quita a una persona del equipo: deja de verlo en su menú y no puede abrirlo", async ({ page, team }) => {
  await login(page, team.admin);
  await page.goto(teamBoardUrl);
  await page.getByRole("button", { name: "Opciones del tablero" }).click();
  await page.getByRole("menuitem", { name: "Personas del tablero" }).click();
  const dialog = page.getByRole("dialog", { name: "Personas del tablero" });
  await dialog.getByRole("button", { name: new RegExp(`Quitar a ${team.outsider.name}`) }).click();
  const saved = page.waitForResponse((r) => r.url().includes("/rpc/set_board_members") && r.ok());
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await saved;
  await expect(page.getByText("Tablero de equipo · 2 personas")).toBeVisible();

  await login(page, team.outsider);
  await page.goto("/");
  await expect(sidebar(page).getByRole("link", { name: "Equipo Ventas" })).toHaveCount(0);
  await page.goto(teamBoardUrl);
  await expect(page.getByText("Tablero no encontrado")).toBeVisible();
});

test("el admin ve también tableros personales ajenos, y puede archivar", async ({ page, team }) => {
  await login(page, team.admin);
  await page.goto("/todos");
  const others = page.getByRole("region", { name: "Otros tableros del equipo" });
  await expect(others.getByRole("link", { name: /Mis pendientes/ })).toBeVisible();

  await page.goto(teamBoardUrl);
  await page.getByRole("button", { name: "Opciones del tablero" }).click();
  await page.getByRole("menuitem", { name: "Archivar tablero" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Archivar" }).click();
  await expect(page).toHaveURL(/\/todos$/);
  await expect(page.getByRole("link", { name: /Equipo Ventas/ })).toHaveCount(0);
  await page.goto(teamBoardUrl);
  await expect(page.getByText("Este tablero está archivado")).toBeVisible();
});
