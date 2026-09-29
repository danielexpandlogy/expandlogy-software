import { expect, test } from "./support/fixtures";
import { createBoardFor, login, settleAnimations } from "./support/identities";

// Regresión: el área táctil ampliada del checkbox no debe tapar controles vecinos.
test("el asa de la subtarea y el chevron de la lista no quedan tapados por el checkbox", async ({ page, team }) => {
  const boardId = await createBoardFor(team.admin, team.member, "Áreas e2e");
  const { data: s } = await team.member.client.from("sections").select("id").eq("board_id", boardId).order("position");
  const { data: t } = await team.member.client
    .from("tasks")
    .insert({ board_id: boardId, section_id: s![0].id, title: "Padre", position: "a0" })
    .select()
    .single();
  await team.member.client.from("tasks").insert({ board_id: boardId, parent_id: t!.id, title: "Hija", position: "a0" });
  await login(page, team.member);

  const hitsItself = (name: string) =>
    page.getByRole("button", { name }).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!hit && (hit === el || el.contains(hit));
    });

  await page.goto(`/todos/${boardId}/t/${t!.id}`);
  await page.getByRole("button", { name: "Mover subtarea Hija" }).waitFor();
  await settleAnimations(page);
  expect(await hitsItself("Mover subtarea Hija")).toBe(true);

  await page.goto(`/todos/${boardId}?vista=lista`);
  await page.getByRole("button", { name: "Mostrar subtareas de Padre" }).waitFor();
  expect(await hitsItself("Mostrar subtareas de Padre")).toBe(true);
});
