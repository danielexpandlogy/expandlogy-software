import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { createBoardFor, login } from "./support/identities";

let boardId: string;
let taskId: string;

test.beforeAll(async ({ team }) => {
  boardId = await createBoardFor(team.admin, team.member, "Accesible e2e");
  const { data: sections } = await team.member.client.from("sections").select("*").eq("board_id", boardId).order("position");
  const { data } = await team.member.client
    .from("tasks")
    .insert({ board_id: boardId, section_id: sections![0].id, title: "Tarea accesible", position: "a0", priority: "high", due_date: "2026-01-01" })
    .select()
    .single();
  taskId = data!.id;
  await team.member.client.from("tasks").insert({ board_id: boardId, parent_id: taskId, title: "Subtarea", position: "a0" });
  await team.member.client.rpc("create_comment", { p_task_id: taskId, p_body: "Comentario con https://expandlogy.com" });
});

/** 0 violaciones serias o críticas (WCAG 2.1 AA). */
async function audit(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const detail = serious.flatMap((v) =>
    v.nodes.map((n) => `${v.id}: ${n.html.slice(0, 110)} ${n.any[0]?.message?.slice(0, 120) ?? ""}`),
  );
  expect(detail, `${label}\n${detail.join("\n")}`).toEqual([]);
}

test("índice de tableros (admin)", async ({ page, team }) => {
  await login(page, team.admin);
  await page.goto("/todos");
  await expect(page.getByRole("heading", { name: "To-do List" })).toBeVisible();
  await audit(page, "índice");
});

test("kanban", async ({ page, team }) => {
  await login(page, team.member);
  await page.goto(`/todos/${boardId}?vista=kanban`);
  await expect(page.getByTestId("kanban")).toBeVisible();
  await audit(page, "kanban");
});

test("lista con subtareas desplegadas", async ({ page, team }) => {
  await login(page, team.member);
  await page.goto(`/todos/${boardId}?vista=lista`);
  await page.getByRole("button", { name: /Mostrar subtareas/ }).click();
  await audit(page, "lista");
});

test("panel de detalle con comentarios", async ({ page, team }) => {
  await login(page, team.member);
  await page.goto(`/todos/${boardId}/t/${taskId}`);
  await expect(page.getByRole("article")).toHaveCount(1);
  await audit(page, "detalle");
});

test("login y Home", async ({ page, team }) => {
  await page.goto("/login");
  await audit(page, "login");
  await login(page, team.member);
  await page.goto("/");
  await expect(page.getByText("Próximas tareas")).toBeVisible();
  await audit(page, "home");
});
