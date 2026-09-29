import { describe, expect, it } from "vitest";
import { applyChange, toMillis } from "./realtime";

const row = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: id, updated_at: "2026-09-29T10:00:00.000+00:00", ...extra });

describe("toMillis", () => {
  it("entiende los formatos de Postgres, PostgREST e ISO", () => {
    const iso = Date.parse("2026-09-29T05:28:08.039Z");
    expect(toMillis("2026-09-29 05:28:08.039+00")).toBe(iso);
    expect(toMillis("2026-09-29T05:28:08.039+00:00")).toBe(iso);
    expect(toMillis("2026-09-29T05:28:08.039Z")).toBe(iso);
    expect(toMillis(null)).toBeNull();
    expect(toMillis("basura")).toBeNull();
  });
});

describe("applyChange", () => {
  const list = [row("a"), row("b")];

  it("INSERT agrega y UPDATE fusiona", () => {
    expect(applyChange(list, "INSERT", row("c")).map((r) => r.id)).toEqual(["a", "b", "c"]);
    const next = applyChange(list, "UPDATE", row("a", { title: "nuevo", updated_at: "2026-09-29 10:00:05+00" }));
    expect(next[0].title).toBe("nuevo");
  });

  it("un evento más viejo no pisa lo que ya hay", () => {
    const next = applyChange(list, "UPDATE", row("a", { title: "viejo", updated_at: "2026-09-29 09:59:00+00" }));
    expect(next).toBe(list);
  });

  it("el eco idéntico de una escritura propia no cambia la referencia", () => {
    expect(applyChange(list, "UPDATE", row("a"))).toBe(list);
  });

  it("DELETE quita sólo si existe (los DELETE de otros tableros se ignoran)", () => {
    expect(applyChange(list, "DELETE", { id: "b" }).map((r) => r.id)).toEqual(["a"]);
    expect(applyChange(list, "DELETE", { id: "zzz" })).toBe(list);
  });
});
