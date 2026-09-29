import { expect, test } from "./support/fixtures";
import { createBoardFor, login, service } from "./support/identities";

// Mide sobre el build de producción: PERF_BASE_URL=http://127.0.0.1:4173 (vite preview).
// Sin esa variable se salta (en dev, sin bundle, los números no significan nada).
const BASE = process.env.PERF_BASE_URL;
test.skip(!BASE, "requiere PERF_BASE_URL (build de producción)");
test.setTimeout(240_000);
// La sesión vive en el localStorage del origen: todo el test en el build de producción.
test.use({ baseURL: BASE });

test("tablero de 500 tareas y 2000 comentarios: carga en 4G y arrastre sin bloqueos", async ({ page, team }) => {
  const boardId = await createBoardFor(team.admin, team.member, "Rendimiento");
  const { data: sections } = await team.member.client.from("sections").select("id").eq("board_id", boardId).order("position");
  const tasks = Array.from({ length: 500 }, (_, i) => ({
    board_id: boardId,
    section_id: sections![i % 3].id,
    title: `Tarea ${i + 1} con un título de largo realista`,
    position: `a${String(i).padStart(4, "0")}`,
    priority: (["high", "medium", "low"] as const)[i % 3],
    completed: i % 5 === 0,
  }));
  const { data: inserted, error } = await service.from("tasks").insert(tasks).select("id");
  if (error) throw error;
  const comments = Array.from({ length: 2000 }, (_, i) => ({
    task_id: inserted![i % 500].id,
    author_id: team.member.id,
    body: `Comentario ${i + 1}`,
  }));
  for (let i = 0; i < comments.length; i += 500) {
    const { error: e } = await service.from("task_comments").insert(comments.slice(i, i + 500));
    if (e) throw e;
  }

  await login(page, team.member);

  // Fast 4G de Chrome DevTools: 9 Mbps de bajada, 1.5 de subida, 60 ms de latencia.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 60,
    downloadThroughput: (9 * 1024 * 1024) / 8,
    uploadThroughput: (1.5 * 1024 * 1024) / 8,
  });
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

  const t0 = Date.now();
  await page.goto(`${BASE}/todos/${boardId}?vista=kanban`);
  const firstCard = page.getByRole("button", { name: /^Abrir tarea: Tarea 2 / });
  await expect(firstCard).toBeVisible({ timeout: 30_000 });
  const loadMs = Date.now() - t0;
  const visibleCards = await page.getByRole("button", { name: /^Abrir tarea:/ }).count();

  // Arrastre: contar tareas largas (>50 ms) del hilo principal durante el movimiento.
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await page.evaluate(() => {
    (window as unknown as { __long: number[] }).__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window as unknown as { __long: number[] }).__long.push(e.duration))).observe({
      type: "longtask",
      buffered: false,
    });
  });
  const a = (await firstCard.boundingBox())!;
  const target = page.getByRole("region", { name: "Sección En progreso" });
  const b = (await target.boundingBox())!;
  const d0 = Date.now();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + 120, { steps: 30 });
  await page.mouse.up();
  const dragMs = Date.now() - d0;
  const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);

  console.log(
    `PERF carga(4G)=${loadMs}ms tarjetas=${visibleCards} arrastre(30 pasos)=${dragMs}ms longtasks=${long.length} max=${Math.round(Math.max(0, ...long))}ms`,
  );
  expect(visibleCards).toBe(400); // 500 menos las 100 completadas ocultas
  expect(loadMs).toBeLessThan(4000);
  expect(Math.max(0, ...long)).toBeLessThan(200);
});
