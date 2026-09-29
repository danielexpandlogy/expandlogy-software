import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { createBoardFor, login, waitForWrite } from "./support/identities";

test.describe.configure({ mode: "serial" });

let boardId: string;
const dialog = (page: Page) => page.getByRole("dialog", { name: "Nueva tarea" });

test.beforeAll(async ({ team }) => {
  boardId = await createBoardFor(team.admin, team.member, "Formulario e2e");
});

test.beforeEach(async ({ page, team }) => {
  await login(page, team.member);
  await page.goto(`/todos/${boardId}?vista=kanban`);
  await expect(page.getByTestId("kanban")).toBeVisible();
});

test("el formulario de nueva tarea permite anotar todo: descripción, sección, prioridad, fecha, recordatorio y subtareas", async ({ page, team }) => {
  await page.getByRole("region", { name: "Sección En progreso" }).getByRole("button", { name: "Añadir tarea" }).click();
  const d = dialog(page);
  await expect(d.getByRole("combobox", { name: "Sección" })).toHaveText("En progreso");

  await d.getByLabel("Título").fill("Preparar propuesta Acme");
  await d.getByLabel("Descripción").fill("Incluir costos del Q4\ny soporte");
  await d.getByRole("combobox", { name: "Prioridad" }).click();
  await page.getByRole("option", { name: "Alta" }).click();
  await d.getByLabel("Fecha límite").fill("2026-12-15");
  await d.getByRole("button", { name: "Recordatorio (Beta)" }).click();
  await page.getByRole("button", { name: /^Mañana, 9:00/ }).click();
  for (const s of ["Revisar precios", "Redactar resumen"]) {
    await d.getByLabel("Subtareas", { exact: true }).fill(s);
    await d.getByLabel("Subtareas", { exact: true }).press("Enter"); // Enter aquí añade la subtarea, no envía
  }
  await expect(d.getByRole("list", { name: "Subtareas de la nueva tarea" }).getByRole("listitem")).toHaveCount(2);
  await d.getByRole("button", { name: "Quitar subtarea Redactar resumen" }).click();
  await d.getByLabel("Subtareas", { exact: true }).fill("Enviar por correo");

  await d.getByRole("button", { name: "Crear tarea" }).click();
  await expect(d).toHaveCount(0);

  const card = page.getByRole("region", { name: "Sección En progreso" }).getByRole("button", { name: "Abrir tarea: Preparar propuesta Acme" });
  await expect(card).toBeVisible();
  await expect(card.getByLabel("0 de 2 subtareas completadas")).toBeVisible({ timeout: 10_000 });

  const { data: rows } = await team.member.client.from("tasks").select("*").eq("board_id", boardId);
  const task = rows!.find((t) => t.title === "Preparar propuesta Acme")!;
  expect(task.description).toBe("Incluir costos del Q4\ny soporte");
  expect(task.priority).toBe("high");
  expect(task.due_date).toBe("2026-12-15");
  expect(task.reminder_at).not.toBeNull();
  const subs = rows!.filter((t) => t.parent_id === task.id).sort((a, b) => (a.position < b.position ? -1 : 1));
  expect(subs.map((s) => s.title)).toEqual(["Revisar precios", "Enviar por correo"]);
});

test("'Crear y abrir' deja la tarea lista para comentar y adjuntar", async ({ page }) => {
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  await dialog(page).getByLabel("Título").fill("Tarea para comentar");
  const saved = waitForWrite(page, "tasks");
  await dialog(page).getByRole("button", { name: "Crear y abrir" }).click();
  await saved;
  await expect(page).toHaveURL(/\/t\/[0-9a-f-]{36}/);
  await expect(page.getByRole("dialog").getByLabel("Título de la tarea")).toHaveValue("Tarea para comentar");
  await expect(page.getByRole("dialog").getByLabel("Escribe un comentario")).toBeVisible();
});

test("sin título no se puede crear; Cancelar no crea nada", async ({ page, team }) => {
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  await expect(dialog(page).getByRole("button", { name: "Crear tarea" })).toBeDisabled();
  await dialog(page).getByLabel("Descripción").fill("Algo sin título");
  await dialog(page).getByRole("button", { name: "Cancelar" }).click();
  const { data } = await team.member.client.from("tasks").select("id").eq("board_id", boardId).eq("description", "Algo sin título");
  expect(data).toHaveLength(0);
});
