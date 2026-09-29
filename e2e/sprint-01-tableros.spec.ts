import { expect, test } from "./support/fixtures";
import { login, waitForWrite } from "./support/identities";

test.describe.configure({ mode: "serial" });

test("sin sesión, /todos y cualquier tablero redirigen a /login", async ({ page }) => {
  await page.goto("/todos");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/todos/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/login$/);
});

test("un usuario sin tablero ve el estado vacío", async ({ page, team }) => {
  await login(page, team.member);
  await page.goto("/todos");
  await expect(page.getByText("Aún no tienes un tablero")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(/Pídele a un administrador que te añada/)).toBeVisible();
});

test("el admin añade un usuario al To-do List y se crea su tablero", async ({ page, team }) => {
  await login(page, team.admin);
  await page.goto("/todos");
  await page.getByRole("button", { name: "Añadir usuario" }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Buscar por nombre o email…").fill(team.member.email);
  await dialog.getByRole("option", { name: new RegExp(team.member.email) }).click();
  await expect(dialog.getByLabel("Nombre del tablero")).toHaveValue(/^Tablero de E2E/);
  await dialog.getByLabel("Nombre del tablero").fill("Tablero Sprint 1");
  await dialog.getByRole("button", { name: "Crear tablero" }).click();

  await expect(page).toHaveURL(/\/todos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Tablero Sprint 1" })).toBeVisible();
  for (const s of ["Por hacer", "En progreso", "Listo"]) {
    await expect(page.getByRole("heading", { name: new RegExp(`^${s}`) })).toBeVisible();
  }

  // Ya no aparece como candidato.
  await page.goto("/todos");
  await page.getByRole("button", { name: "Añadir usuario" }).first().click();
  await page.getByRole("dialog").getByPlaceholder("Buscar por nombre o email…").fill(team.member.email);
  await expect(page.getByRole("dialog").getByRole("option", { name: new RegExp(team.member.email) })).toHaveCount(0);
});

test("el miembro entra directo a su tablero y crea tareas desde el Home", async ({ page, team }) => {
  await login(page, team.member);
  await page.goto("/todos");
  await expect(page).toHaveURL(/\/todos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Tablero Sprint 1" })).toBeVisible();
  const boardUrl = page.url();

  await page.goto("/");
  await page.getByPlaceholder("Añadir tarea rápida…").fill("Tarea desde el Home");
  const saved = waitForWrite(page, "tasks");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await saved;
  await expect(page.getByRole("link", { name: /Tarea desde el Home/ })).toBeVisible();
  await expect(page.getByText("Pendientes", { exact: true }).locator("..").getByText("1")).toBeVisible();

  await page.goto(boardUrl);
  await expect(page.getByRole("button", { name: "Abrir tarea: Tarea desde el Home" })).toBeVisible();
  team.member.boardUrl = boardUrl;
});

test("un usuario ajeno no puede abrir el tablero de otro", async ({ page, team }) => {
  await login(page, team.outsider);
  await page.goto(team.member.boardUrl!);
  await expect(page.getByText("Tablero no encontrado")).toBeVisible();
  await expect(page.getByText("Tarea desde el Home")).toHaveCount(0);
});

test("el admin renombra y archiva el tablero", async ({ page, team }) => {
  await login(page, team.admin);
  await page.goto(team.member.boardUrl!);
  await page.getByRole("button", { name: "Opciones del tablero" }).click();
  await page.getByRole("menuitem", { name: "Renombrar" }).click();
  await page.getByLabel("Nombre del tablero").fill("Tablero renombrado");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Tablero renombrado" })).toBeVisible();

  await page.getByRole("button", { name: "Opciones del tablero" }).click();
  await page.getByRole("menuitem", { name: "Archivar tablero" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Archivar" }).click();
  await expect(page).toHaveURL(/\/todos$/);
  await expect(page.getByText("Tablero renombrado")).toHaveCount(0);

  await page.goto(team.member.boardUrl!);
  await expect(page.getByText("Este tablero está archivado")).toBeVisible();
});
