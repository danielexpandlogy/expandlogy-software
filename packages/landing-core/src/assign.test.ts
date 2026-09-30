import { describe, expect, it } from "vitest";
import { chooseSelection, type PublicConfig, type PublicOption } from "./assign";

const option = (id: string, extra: Partial<PublicOption> = {}): PublicOption => ({
  id,
  label: id,
  value: { v: id },
  is_control: id.endsWith("a"),
  active: true,
  position: 0,
  visitors: 0,
  conversions: 0,
  ...extra,
});

const config = (overrides: Partial<PublicConfig["variables"][number]> = {}): PublicConfig => ({
  settings: { auto_optimize: true, min_visitors_per_option: 300, min_conversions_to_win: 30, win_probability: 0.95, traffic_floor: 0.1 },
  variables: [
    { id: "v1", key: "headline", enabled: true, winner_option_id: null, options: [option("1a"), option("1b")], ...overrides },
  ],
});

describe("chooseSelection", () => {
  it("sortea entre las activas y registra la asignación", () => {
    const low = chooseSelection(config(), {}, [], () => 0.1);
    const high = chooseSelection(config(), {}, [], () => 0.9);
    expect(low.assignments).toEqual({ v1: "1a" });
    expect(high.assignments).toEqual({ v1: "1b" });
    expect(high.values).toEqual({ headline: { v: "1b" } });
    expect(high.combo).toBe("headline:B");
  });

  it("conserva lo que el visitante ya vio", () => {
    const s = chooseSelection(config(), { v1: "1b" }, [], () => 0);
    expect(s.assignments).toEqual({ v1: "1b" });
  });

  it("si su opción se pausó, vuelve a sortear entre las activas", () => {
    const c = config({ options: [option("1a"), option("1b", { active: false })] });
    expect(chooseSelection(c, { v1: "1b" }, [], () => 0.9).assignments).toEqual({ v1: "1a" });
  });

  it("variable apagada: no aplica nada", () => {
    const s = chooseSelection(config({ enabled: false }), {}, []);
    expect(s).toEqual({ values: {}, assignments: {}, combo: "" });
  });

  it("ganador fijado: lo muestra a todos y no registra", () => {
    const s = chooseSelection(config({ winner_option_id: "1b" }), { v1: "1a" }, []);
    expect(s.values).toEqual({ headline: { v: "1b" } });
    expect(s.assignments).toEqual({});
  });

  it("la opción original no aplica valor: se ve el contenido del código", () => {
    const s = chooseSelection(config(), {}, [], () => 0.1);
    expect(s.assignments).toEqual({ v1: "1a" });
    expect(s.values).toEqual({});
    expect(s.combo).toBe("headline:A");
  });

  it("vista previa: fuerza la opción aunque esté apagada y no registra", () => {
    const s = chooseSelection(config({ enabled: false, options: [option("1a"), option("1b", { active: false })] }), {}, ["1b"]);
    expect(s.values).toEqual({ headline: { v: "1b" } });
    expect(s.assignments).toEqual({});
  });
});
