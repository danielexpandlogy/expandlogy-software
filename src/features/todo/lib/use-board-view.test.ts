import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveView } from "./use-board-view";
import { readLocal, writeLocal } from "./use-local-state";

describe("resolveView", () => {
  it("la URL gana sobre lo guardado", () => {
    expect(resolveView("lista", "kanban", false)).toBe("lista");
    expect(resolveView("kanban", "lista", true)).toBe("kanban");
  });

  it("sin URL usa lo guardado", () => {
    expect(resolveView(null, "lista", false)).toBe("lista");
  });

  it("valores inválidos se ignoran y se usa el valor por defecto según el dispositivo", () => {
    expect(resolveView("tabla", "otra", false)).toBe("kanban");
    expect(resolveView(null, null, true)).toBe("lista");
  });
});

describe("localStorage roto", () => {
  afterEach(() => vi.restoreAllMocks());

  it("leer y escribir no lanzan (modo privado / datos bloqueados)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(readLocal("x", "defecto")).toBe("defecto");
    expect(() => writeLocal("x", "valor")).not.toThrow();
  });

  it("JSON corrupto devuelve el valor por defecto", () => {
    window.localStorage.setItem("roto", "{no es json");
    expect(readLocal("roto", 42)).toBe(42);
  });
});
