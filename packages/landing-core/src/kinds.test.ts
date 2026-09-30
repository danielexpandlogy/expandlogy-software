import { describe, expect, it } from "vitest";
import { readColor, readCta, readHeadline, readImage, readOrder, readText, validateValue } from "./kinds";

describe("read*", () => {
  it("lee valores válidos", () => {
    expect(readHeadline({ before: "A ", highlight: "B", after: "." })).toEqual({ before: "A ", highlight: "B", after: "." });
    expect(readText({ text: "Hola" })).toBe("Hola");
    expect(readImage({ src: "https://x.test/a.jpg", alt: "a" })).toEqual({ src: "https://x.test/a.jpg", alt: "a" });
    expect(readCta({ label: "Go" })).toEqual({ label: "Go", sub: "" });
    expect(readColor({ color: "#112233" })).toEqual({ color: "#112233", hover: "#112233" });
  });

  it("devuelve null con valores inválidos (la landing muestra el original)", () => {
    expect(readHeadline({ before: 1 })).toBeNull();
    expect(readHeadline({ before: " ", highlight: "", after: "" })).toBeNull();
    expect(readText({ text: "   " })).toBeNull();
    expect(readImage({ src: "javascript:alert(1)" })).toBeNull();
    expect(readImage({ src: "http://x.test/a.jpg" })).toBeNull();
    expect(readCta({ label: "x".repeat(61) })).toBeNull();
    expect(readColor({ color: "red" })).toBeNull();
    expect(readOrder({ order: "a" }, ["a", "b"])).toBeNull();
  });

  it("readOrder quita repetidas y desconocidas y completa las que faltan", () => {
    expect(readOrder({ order: ["c", "c", "x"] }, ["a", "b", "c"])).toEqual(["c", "a", "b"]);
  });
});

describe("validateValue", () => {
  it("acepta lo que la landing puede leer", () => {
    expect(validateValue("text", { text: "Hola" }, [])).toBeNull();
    expect(validateValue("order", { order: ["b", "a"] }, ["a", "b"])).toBeNull();
  });

  it("explica qué falta", () => {
    expect(validateValue("text", { text: "" }, [])).toMatch(/texto/i);
    expect(validateValue("order", { order: ["a"] }, ["a", "b"])).toMatch(/secciones/i);
    expect(validateValue("image", { src: "https://x.test/a.jpg", alt: "" }, [])).toMatch(/alternativo/i);
  });
});
