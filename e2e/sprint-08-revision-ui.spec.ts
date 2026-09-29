import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { createBoardFor, login } from "./support/identities";

// Recorre las pantallas principales en escritorio y móvil y falla si algo se
// sale de la pantalla, hay scroll horizontal, la ventana de layout se ensancha
// (móvil), una tabla no cabe o hay errores de consola. Capturas en test-results/.
const OUT = "test-results/revision-ui";
let boardId: string, taskId: string;

test.beforeAll(async ({ team }) => {
  boardId = await createBoardFor(team.admin, team.member, "Equipo Ventas");
  const c = team.member.client;
  const { data: s } = await c.from("sections").select("id").eq("board_id", boardId).order("position");
  const rows = [
    ["Enviar propuesta a cliente Acme con el desglose del Q4", 0, "high", "2026-09-20"],
    ["Revisar contrato de proveedor", 0, "medium", "2026-10-02"],
    ["Preparar reporte semanal", 0, "low", null],
    ["Actualizar roadmap del producto", 1, "high", "2026-10-05"],
    ["Diseño de onboarding", 1, "low", null],
    ["Llamar a proveedor", 2, "medium", null],
  ] as const;
  let i = 0;
  for (const [title, sec, priority, due] of rows) {
    const first = i === 0;
    const { data } = await c
      .from("tasks")
      .insert({
        board_id: boardId,
        section_id: s![sec].id,
        title,
        priority,
        due_date: due,
        position: "a" + i++,
        reminder_at: first ? new Date(Date.now() + 864e5).toISOString() : null,
        description: first ? "Incluir costos y la propuesta de soporte." : "",
      })
      .select()
      .single();
    if (first) taskId = data!.id;
  }
  for (const [j, t] of ["Revisar precios", "Redactar resumen", "Enviar por correo"].entries())
    await c.from("tasks").insert({ board_id: boardId, parent_id: taskId, title: t, position: "a" + j, completed: j === 0 });
  await team.admin.client.rpc("create_comment", { p_task_id: taskId, p_body: "¿Ya tenemos cotización? Revisa https://expandlogy.com/pedidos" });
  await c.rpc("create_comment", { p_task_id: taskId, p_body: "Sí, la mando hoy por la tarde." });
});

const problems: string[] = [];
async function check(page: Page, name: string) {
  await page.waitForTimeout(500);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const issues = await page.evaluate(() => {
    const out: string[] = [];
    // Ancho VISIBLE: en móvil innerWidth crece con el contenido desbordado y lo ocultaría.
    const w = document.documentElement.clientWidth;
    if (window.innerWidth > w + 1) out.push(`ventana de layout ensanchada: innerWidth ${window.innerWidth} > ${w}`);
    if (document.documentElement.scrollWidth > w + 1) out.push(`scroll horizontal de página: ${document.documentElement.scrollWidth} > ${w}`);
    // Controles visibles que se salen del viewport (salvo dentro de contenedores con scroll propio).
    for (const el of Array.from(document.querySelectorAll("button, a, input, [role=button], h1, h2, h3"))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      let p = el.parentElement;
      let clipped = false;
      while (p) {
        const o = getComputedStyle(p).overflowX;
        if (o === "auto" || o === "scroll" || o === "hidden") {
          clipped = true;
          break;
        }
        p = p.parentElement;
      }
      if (!clipped && (r.right > w + 1 || r.left < -1)) {
        out.push(`fuera de pantalla: ${(el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40)}`);
      }
    }
    // Diálogos y menús flotantes completamente dentro de la pantalla.
    for (const el of Array.from(document.querySelectorAll("[role=dialog], [role=alertdialog], [role=menu], [role=listbox]"))) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > w + 1 || r.left < -1)) out.push(`${el.getAttribute("role")} fuera de pantalla (${Math.round(r.left)}–${Math.round(r.right)})`);
    }
    // Tablas que no caben (quedan columnas cortadas tras un scroll horizontal).
    for (const t of Array.from(document.querySelectorAll("table"))) {
      const box = t.parentElement!;
      if (box.scrollWidth > box.clientWidth + 1) out.push(`tabla con scroll horizontal (${box.scrollWidth} > ${box.clientWidth})`);
    }
    return out;
  });
  for (const i of issues) problems.push(`${name} → ${i}`);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

for (const [label, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
] as const) {
  test(`UI ${label}`, async ({ browser, team }) => {
    const ctx = await browser.newContext({ viewport, isMobile: label === "mobile", hasTouch: label === "mobile" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => problems.push(`${label} error JS: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && problems.push(`${label} consola: ${m.text().slice(0, 140)}`));
    await page.goto("/login");
    await check(page, `${label}-01-login`);
    await login(page, team.member);
    await expect(page.getByText("Próximas tareas")).toBeVisible();
    await check(page, `${label}-02-home`);
    await page.goto("/todos");
    await expect(page.getByRole("heading", { name: "To-do List", level: 2 })).toBeVisible();
    await check(page, `${label}-03-indice`);
    await page.goto(`/todos/${boardId}?vista=kanban`);
    await expect(page.getByTestId("kanban")).toBeVisible();
    await check(page, `${label}-04-kanban`);
    await page.getByRole("button", { name: "Opciones del tablero" }).click();
    await check(page, `${label}-05-menu`);
    await page.getByRole("menuitemradio", { name: "Lista" }).click();
    await page.getByRole("button", { name: /Mostrar subtareas/ }).click();
    await check(page, `${label}-06-lista`);
    await page.getByRole("region", { name: "Sección Por hacer" }).getByRole("button", { name: "Añadir tarea" }).click();
    await page.getByRole("dialog", { name: "Nueva tarea" }).getByRole("combobox", { name: "Prioridad" }).click();
    await check(page, `${label}-07-nueva-tarea`);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.goto(`/todos/${boardId}/t/${taskId}?vista=kanban`);
    await expect(page.getByRole("dialog").getByRole("article")).toHaveCount(2);
    await check(page, `${label}-08-detalle`);
    await page.getByRole("dialog").getByRole("article").last().scrollIntoViewIfNeeded();
    await check(page, `${label}-09-detalle-comentarios`);
    await page.goto("/perfil");
    await check(page, `${label}-10-perfil`);
    await login(page, team.admin);
    await page.goto("/perfil/usuarios");
    await expect(page.getByText(team.member.email).first()).toBeVisible();
    await check(page, `${label}-11-usuarios`);
    await page.goto("/todos");
    await page.getByRole("button", { name: "Nuevo tablero" }).first().click();
    await check(page, `${label}-12-nuevo-tablero`);
    await page.keyboard.press("Escape");
    await page.goto(`/todos/${boardId}`);
    await page.getByRole("button", { name: "Opciones del tablero" }).click();
    await page.getByRole("menuitem", { name: "Personas del tablero" }).click();
    await check(page, `${label}-13-personas`);
    if (label === "mobile") {
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
      await check(page, `${label}-14-menu-lateral`);
    }
    await ctx.close();
    expect(problems.filter((p) => p.startsWith(label)), "problemas de UI").toEqual([]);
  });
}
