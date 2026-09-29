import { webkit, type Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { createBoardFor, login, service } from "./support/identities";

// Micrófono falso de Chrome: permite probar la grabación real con MediaRecorder.
test.use({
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  permissions: ["microphone"],
});
test.describe.configure({ mode: "serial" });

let boardId: string;
let taskId: string;
const panel = (page: Page) => page.getByRole("dialog").first();
const comment = (page: Page, text: string) => panel(page).getByRole("article").filter({ hasText: text });

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** WAV PCM mono válido de `seconds` segundos. */
function wav(seconds = 1, rate = 8000) {
  const n = seconds * rate;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 8) * 8000), 44 + i * 2);
  return b;
}

async function openTask(page: Page) {
  await page.goto(`/todos/${boardId}/t/${taskId}?vista=kanban`);
  await expect(panel(page).getByLabel("Escribe un comentario")).toBeVisible();
}

async function sendComment(page: Page, text: string) {
  await expect(panel(page).getByRole("button", { name: "Enviar" })).toBeEnabled({ timeout: 20_000 });
  const done = page.waitForResponse((r) => r.url().includes("/rpc/create_comment") && r.ok());
  if (text) await panel(page).getByLabel("Escribe un comentario").fill(text);
  await panel(page).getByRole("button", { name: "Enviar" }).click();
  await done;
}

test.beforeAll(async ({ team }) => {
  boardId = await createBoardFor(team.admin, team.member, "Adjuntos e2e");
  const { data: sections } = await team.member.client.from("sections").select("*").eq("board_id", boardId).order("position");
  const { data } = await team.member.client
    .from("tasks")
    .insert({ board_id: boardId, section_id: sections![0].id, title: "Pedido de cajas", position: "a0" })
    .select()
    .single();
  taskId = data!.id;
});

test.beforeEach(async ({ page, team }) => {
  await login(page, team.member);
});

test("adjuntar dos imágenes, quitar una antes de enviar y verla en el comentario", async ({ page }) => {
  await openTask(page);
  // Imagen grande generada en el navegador: debe redimensionarse a 2560 px.
  const big = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 4000;
    c.height = 3000;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 4000, 3000);
    grad.addColorStop(0, "#4f46e5");
    grad.addColorStop(1, "#f59e0b");
    g.fillStyle = grad;
    g.fillRect(0, 0, 4000, 3000);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.95));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await panel(page).getByLabel("Adjuntar imágenes o audios").setInputFiles([
    { name: "pedido.jpg", mimeType: "image/jpeg", buffer: Buffer.from(big) },
    { name: "descartar.png", mimeType: "image/png", buffer: PNG },
  ]);
  const chips = panel(page).getByRole("list", { name: "Adjuntos del comentario" }).getByRole("listitem");
  await expect(chips).toHaveCount(2);
  await panel(page).getByRole("button", { name: "Quitar descartar.png" }).click();
  await expect(chips).toHaveCount(1);

  await sendComment(page, "Foto del pedido");
  const c = comment(page, "Foto del pedido");
  await expect(c.getByRole("button", { name: "Ver imagen 1 de 1" }).locator("img")).toHaveAttribute("src", /token=/);
  await expect(panel(page).getByRole("list", { name: "Adjuntos del comentario" })).toHaveCount(0);

  const { data } = await service.from("comment_attachments").select("*").eq("board_id", boardId);
  expect(data).toHaveLength(1);
  expect(Math.max(data![0].width, data![0].height)).toBe(2560);
  expect(data![0].mime_type).toBe("image/jpeg");
});

test("imágenes pequeñas conservan sus dimensiones reales (no 0×0)", async ({ page }) => {
  await openTask(page);
  const small = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 400;
    c.getContext("2d")!.fillRect(0, 0, 640, 400);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await panel(page).getByLabel("Adjuntar imágenes o audios").setInputFiles({ name: "chica.png", mimeType: "image/png", buffer: Buffer.from(small) });
  await sendComment(page, "Imagen chica");
  const { data } = await service.from("comment_attachments").select("width,height").eq("board_id", boardId).eq("mime_type", "image/png");
  expect(data).toEqual([{ width: 640, height: 400 }]);
  const thumb = comment(page, "Imagen chica").getByRole("button", { name: "Ver imagen 1 de 1" });
  const box = (await thumb.boundingBox())!;
  expect(Math.abs(box.width / box.height - 640 / 400)).toBeLessThan(0.05);
});

test("el visor abre la imagen a pantalla completa y se cierra con Esc", async ({ page }) => {
  await openTask(page);
  await comment(page, "Foto del pedido").getByRole("button", { name: "Ver imagen 1 de 1" }).click();
  const viewer = page.getByRole("dialog", { name: "Imagen 1 de 1" });
  await expect(viewer.getByRole("img", { name: "Imagen 1" })).toBeVisible();
  await expect(viewer.getByRole("link", { name: "Descargar" })).toHaveAttribute("href", /download/);
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(panel(page)).toBeVisible();
});

test("adjuntar un archivo de audio: reproductor con su duración", async ({ page }) => {
  await openTask(page);
  await panel(page).getByLabel("Adjuntar imágenes o audios").setInputFiles({ name: "nota.wav", mimeType: "audio/wav", buffer: wav(2) });
  await sendComment(page, "Nota en archivo");
  const player = comment(page, "Nota en archivo").getByTestId("audio-player");
  await expect(player).toContainText("0:02");
  await expect(player.getByRole("button", { name: "Reproducir audio" })).toBeEnabled();
});

test("grabar una nota de voz en el navegador, escucharla y adjuntarla (sin texto)", async ({ page }) => {
  await openTask(page);
  await panel(page).getByRole("button", { name: "Grabar nota de voz" }).click();
  const rec = page.getByRole("dialog").last();
  await expect(rec).toContainText("Grabando");
  await page.waitForTimeout(2200);
  await rec.getByRole("button", { name: "Detener" }).click();
  await expect(rec.getByLabel("Vista previa de la nota de voz")).toBeVisible();
  await rec.getByRole("button", { name: "Adjuntar" }).click();
  await sendComment(page, "");
  const players = panel(page).getByTestId("audio-player");
  await expect(players).toHaveCount(2);
  // Duración real de la grabación (≥2 s; bajo carga puede tardar algo más en detenerse).
  await expect(players.last()).toContainText(/0:0[2-6]/);
  const { data } = await service.from("comment_attachments").select("mime_type,duration_ms").eq("kind", "audio").eq("board_id", boardId);
  // MP4/AAC: el formato que reproducen todos los navegadores (también Safari).
  expect(data!.some((a) => a.mime_type.startsWith("audio/mp4") && a.duration_ms! >= 2000)).toBe(true);

  // Y suena de verdad: el tiempo de reproducción avanza.
  const player = players.last();
  await player.getByRole("button", { name: "Reproducir audio" }).click();
  await expect.poll(() => player.locator("audio").evaluate((a: HTMLAudioElement) => a.currentTime), { timeout: 10_000 }).toBeGreaterThan(0.3);
  await expect(player.getByRole("alert")).toHaveCount(0);
});

test("las notas de voz también se reproducen en Safari (WebKit)", async ({ team }) => {
  const browser = await webkit.launch();
  const page = await (await browser.newContext()).newPage();
  await login(page, team.member);
  await page.goto(`/todos/${boardId}/t/${taskId}`);
  const players = page.getByRole("dialog").first().getByTestId("audio-player");
  await expect(players).toHaveCount(2);
  for (const player of await players.all()) {
    await player.getByRole("button", { name: "Reproducir audio" }).click();
    await expect.poll(() => player.locator("audio").evaluate((a: HTMLAudioElement) => a.currentTime), { timeout: 10_000 }).toBeGreaterThan(0.3);
    await player.getByRole("button", { name: "Pausar audio" }).click().catch(() => {});
  }
  await browser.close();
});

test("sin permiso de micrófono se explica y se puede seguir adjuntando archivos", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denegado", "NotAllowedError"));
  });
  await openTask(page);
  await panel(page).getByRole("button", { name: "Grabar nota de voz" }).click();
  await expect(page.getByText("Activa el micrófono en la configuración del navegador")).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Adjuntar archivo" })).toBeEnabled();
});

test("tipos no admitidos se rechazan con el motivo, sin bloquear al resto", async ({ page }) => {
  await openTask(page);
  await panel(page).getByLabel("Adjuntar imágenes o audios").setInputFiles([
    { name: "contrato.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
    { name: "ok.png", mimeType: "image/png", buffer: PNG },
  ]);
  await expect(page.getByText("Archivo no admitido")).toBeVisible();
  await expect(panel(page).getByRole("list", { name: "Adjuntos del comentario" }).getByRole("listitem")).toHaveCount(1);
});

test("el admin ve los adjuntos; al borrar el comentario se borran también de Storage", async ({ page, team }) => {
  await login(page, team.admin);
  await openTask(page);
  await expect(comment(page, "Foto del pedido").getByRole("button", { name: "Ver imagen 1 de 1" }).locator("img")).toHaveAttribute(
    "src",
    /token=/,
  );
  const { data: before } = await service.from("comment_attachments").select("storage_path").eq("board_id", boardId);
  const imagePath = before!.find((a) => a.storage_path.endsWith(".jpg"))!.storage_path;

  await comment(page, "Foto del pedido").getByRole("button", { name: "Opciones del comentario" }).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  const deleted = page.waitForResponse((r) => r.url().includes("/rest/v1/task_comments") && r.request().method() === "DELETE");
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
  await deleted;

  const [folder, file] = [imagePath.split("/").slice(0, 2).join("/"), imagePath.split("/")[2]];
  const { data: left } = await service.storage.from("task-attachments").list(folder, { search: file });
  expect(left).toHaveLength(0);
});
