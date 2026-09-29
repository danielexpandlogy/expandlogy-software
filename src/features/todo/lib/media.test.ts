import { describe, expect, it } from "vitest";
import { baseType, classify, extensionFor, fitWithin, formatDuration, storagePathFor } from "./media";

const MB = 1024 * 1024;

describe("classify", () => {
  it("acepta imágenes y audios permitidos dentro del límite", () => {
    expect(classify({ type: "image/jpeg", size: 2 * MB })).toEqual({ kind: "image" });
    expect(classify({ type: "audio/webm;codecs=opus", size: 1 * MB })).toEqual({ kind: "audio" });
    expect(classify({ type: "audio/mp4", size: 24 * MB })).toEqual({ kind: "audio" });
  });

  it("rechaza tamaños por encima del límite con un motivo legible", () => {
    expect(classify({ type: "image/png", size: 11 * MB, name: "foto.png" })).toEqual({ error: "foto.png supera 10 MB" });
    expect(classify({ type: "audio/mpeg", size: 26 * MB })).toHaveProperty("error");
  });

  it("rechaza otros tipos (video, PDF, SVG, HEIC sin convertir)", () => {
    for (const type of ["video/mp4", "application/pdf", "image/svg+xml", "image/heic", ""]) {
      expect(classify({ type, size: 10 })).toHaveProperty("error");
    }
  });
});

describe("fitWithin", () => {
  it("no agranda imágenes pequeñas", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("limita el lado mayor a 2560 respetando la proporción", () => {
    expect(fitWithin(5120, 2880)).toEqual({ width: 2560, height: 1440 });
    expect(fitWithin(3000, 6000)).toEqual({ width: 1280, height: 2560 });
  });
});

describe("rutas de Storage", () => {
  it("{tablero}/{tarea}/{uuid}.{ext} con extensión según el tipo real", () => {
    const p = storagePathFor("b1", "t1", "audio/webm;codecs=opus");
    expect(p).toMatch(/^b1\/t1\/[0-9a-f-]{36}\.webm$/);
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("audio/x-m4a")).toBe("m4a");
    expect(baseType("Audio/MP4; codecs=mp4a")).toBe("audio/mp4");
  });
});

describe("formatDuration", () => {
  it("m:ss", () => {
    expect(formatDuration(15_000)).toBe("0:15");
    expect(formatDuration(600_000)).toBe("10:00");
    expect(formatDuration(61_400)).toBe("1:01");
  });
});
