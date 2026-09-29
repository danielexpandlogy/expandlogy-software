import { devices, type Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { createBoardFor, login } from "./support/identities";

test.use({ ...devices["iPhone 13"], browserName: "chromium" });
test.describe.configure({ mode: "serial" });

let boardId: string;

test.beforeAll(async ({ team }) => {
  boardId = await createBoardFor(team.admin, team.member, "Touch e2e");
  const { data: sections } = await team.member.client.from("sections").select("*").eq("board_id", boardId).order("position");
  await team.member.client.from("tasks").insert({ board_id: boardId, section_id: sections![0].id, title: "Tarjeta táctil", position: "a0" });
});

async function openBoard(page: Page, team: Parameters<Parameters<typeof test>[2]>[0]["team"]) {
  await login(page, team.member);
  await page.goto(`/todos/${boardId}?vista=kanban`); // en móvil la vista por defecto es lista
  const card = page.getByRole("button", { name: "Abrir tarea: Tarjeta táctil" });
  await expect(card).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: string, x = 0, y = 0) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  const b = (await card.boundingBox())!;
  return { card, touch, x: b.x + b.width / 2, y: b.y + b.height / 2, live: page.locator("[id^=DndLiveRegion]") };
}

test("móvil: deslizar rápido hace scroll horizontal y no arrastra", async ({ page, team }) => {
  const { touch, x, y, live } = await openBoard(page, team);
  await touch("touchStart", x, y);
  for (let i = 1; i <= 10; i++) await touch("touchMove", x - i * 25, y);
  await touch("touchEnd");
  await expect.poll(() => page.getByTestId("kanban").evaluate((el) => el.scrollLeft)).toBeGreaterThan(50);
  await expect(live).not.toContainText("Levantaste");
});

test("móvil: mantener pulsado 200 ms levanta la tarjeta para arrastrarla", async ({ page, team }) => {
  const { touch, x, y, live } = await openBoard(page, team);
  await touch("touchStart", x, y);
  await page.waitForTimeout(350);
  await expect(live).toContainText("Levantaste la tarea Tarjeta táctil");
  for (let i = 1; i <= 10; i++) await touch("touchMove", x + i * 5, y + i * 3);
  await touch("touchEnd");
  await expect(live).toContainText("Soltaste la tarea Tarjeta táctil");
});
