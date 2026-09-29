import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { createBoardFor, login, waitForWrite } from "./support/identities";

test.describe.configure({ mode: "serial" });

let boardId: string;
const dialog = (page: Page) => page.getByRole("dialog", { name: "Nueva tarea" });
const addIn = (page: Page, section: string) =>
  page.getByRole("region", { name: `Sección ${section}` }).getByRole("button", { name: "Añadir tarea" }).click();

test.beforeAll(async ({ team }) => {
  boardId = await createBoardFor(team.admin, team.member, "Formulario e2e");
});

test.beforeEach(async ({ page, team }) => {
  await login(page, team.member);
  await page.goto(`/todos/${boardId}?vista=kanban`);
  await expect(page.getByTestId("kanban")).toBeVisible();
});

test("las tareas se crean sólo desde su sección: no hay botón 'Nueva tarea' arriba", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Nueva tarea" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Añadir tarea" })).toHaveCount(3);
});

test("el formulario trae descripción, prioridad con bandera, fecha y recordatorio; sin sección ni subtareas", async ({ page, team }) => {
  await addIn(page, "En progreso");
  const d = dialog(page);
  await expect(d).toContainText("Se añadirá al final de En progreso");
  await expect(d.getByRole("combobox", { name: "Sección" })).toHaveCount(0);
  await expect(d.getByText("Subtareas", { exact: true })).toHaveCount(0);

  await d.getByLabel("Título").fill("Preparar propuesta Acme");
  await d.getByLabel("Descripción").fill("Incluir costos del Q4\ny soporte");
  await d.getByRole("combobox", { name: "Prioridad" }).click();
  await page.getByRole("option", { name: "Alta" }).click();
  await expect(d.getByRole("combobox", { name: "Prioridad" }).locator("svg.lucide-flag")).toHaveCount(1);
  await d.getByLabel("Fecha límite").fill("2026-12-15");
  await d.getByRole("button", { name: "Recordatorio (Beta)" }).click();
  await page.getByRole("button", { name: /^Mañana, 9:00/ }).click();
  await d.getByRole("button", { name: "Crear tarea" }).click();
  await expect(d).toHaveCount(0);

  const card = page.getByRole("region", { name: "Sección En progreso" }).getByRole("button", { name: "Abrir tarea: Preparar propuesta Acme" });
  await expect(card).toBeVisible();
  await expect(card.getByTitle("Prioridad alta")).toBeVisible();

  const { data: rows } = await team.member.client.from("tasks").select("*").eq("board_id", boardId);
  const task = rows!.find((t) => t.title === "Preparar propuesta Acme")!;
  expect(task.description).toBe("Incluir costos del Q4\ny soporte");
  expect(task.priority).toBe("high");
  expect(task.due_date).toBe("2026-12-15");
  expect(task.reminder_at).not.toBeNull();
});

test("un solo botón 'Crear tarea': crea y vuelve al tablero; subtareas y comentarios, al abrir la tarea", async ({ page }) => {
  await addIn(page, "Por hacer");
  await expect(dialog(page).getByRole("button", { name: /Crear/ })).toHaveText(["Crear tarea"]);
  await expect(dialog(page).getByRole("checkbox")).toHaveCount(0);
  await dialog(page).getByLabel("Título").fill("Tarea para completar");
  const saved = waitForWrite(page, "tasks");
  await dialog(page).getByRole("button", { name: "Crear tarea" }).click();
  await saved;
  await expect(dialog(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/t\//);

  await page.getByRole("button", { name: "Abrir tarea: Tarea para completar" }).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("button", { name: "Añadir subtarea" })).toBeVisible();
  await expect(panel.getByLabel("Escribe un comentario")).toBeVisible();
});

test("sin título no se puede crear; Cancelar no crea nada", async ({ page, team }) => {
  await addIn(page, "Listo");
  await expect(dialog(page).getByRole("button", { name: "Crear tarea" })).toBeDisabled();
  await dialog(page).getByLabel("Descripción").fill("Algo sin título");
  await dialog(page).getByRole("button", { name: "Cancelar" }).click();
  const { data } = await team.member.client.from("tasks").select("id").eq("board_id", boardId).eq("description", "Algo sin título");
  expect(data).toHaveLength(0);
});
