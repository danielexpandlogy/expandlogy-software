import { describe, expect, it } from "vitest";
import { byPosition, positionAtEnd, positionBetween, positionForIndex, type Positioned } from "./ordering";

const items = (...positions: string[]): Positioned[] => positions.map((position, i) => ({ id: `id${i}`, position }));

describe("positionBetween", () => {
  it("genera claves ordenadas entre vecinos", () => {
    const k = positionBetween("a0", "a1");
    expect(k > "a0" && k < "a1").toBe(true);
  });

  it("sin vecinos da la clave inicial y soporta extremos abiertos", () => {
    expect(positionBetween(null, null)).toBe("a0");
    expect(positionBetween("a5", null) > "a5").toBe(true);
    expect(positionBetween(null, "a5") < "a5").toBe(true);
  });

  it("no lanza con vecinos empatados o invertidos", () => {
    expect(positionBetween("a3", "a3") > "a3").toBe(true);
    expect(positionBetween("a4", "a3") > "a4").toBe(true);
  });

  it("1000 inserciones en el mismo hueco siguen ordenadas y sin colisiones", () => {
    const keys = ["a0", "a1"];
    let before = "a0";
    for (let i = 0; i < 1000; i++) {
      before = positionBetween(before, "a1");
      keys.push(before);
    }
    const sorted = [...keys].sort();
    expect(new Set(keys).size).toBe(keys.length);
    expect(sorted[0]).toBe("a0");
    expect(sorted[sorted.length - 1]).toBe("a1");
  });
});

describe("positionAtEnd", () => {
  it("va después del mayor, aunque la lista no esté ordenada", () => {
    const k = positionAtEnd(items("a2", "a9", "a1"));
    expect(k > "a9").toBe(true);
  });

  it("lista vacía → clave inicial", () => {
    expect(positionAtEnd([])).toBe("a0");
  });
});

describe("positionForIndex", () => {
  const list = items("a0", "a1", "a2", "a3");

  it("mover al inicio", () => {
    const moved = [list[3], list[0], list[1], list[2]];
    const k = positionForIndex(moved, 0, "id3");
    expect(k < "a0").toBe(true);
  });

  it("mover al final", () => {
    const moved = [list[1], list[2], list[3], list[0]];
    expect(positionForIndex(moved, 3, "id0") > "a3").toBe(true);
  });

  it("mover hacia abajo, entre dos vecinos", () => {
    const moved = [list[1], list[2], list[0], list[3]];
    const k = positionForIndex(moved, 2, "id0");
    expect(k > "a2" && k < "a3").toBe(true);
  });

  it("mover hacia arriba, entre dos vecinos", () => {
    const moved = [list[0], list[3], list[1], list[2]];
    const k = positionForIndex(moved, 1, "id3");
    expect(k > "a0" && k < "a1").toBe(true);
  });

  it("columna vacía (sólo el ítem que llega)", () => {
    expect(positionForIndex([{ id: "x", position: "zz" }], 0, "x")).toBe("a0");
  });
});

describe("byPosition", () => {
  it("desempata por id", () => {
    const sorted = [
      { id: "b", position: "a1" },
      { id: "a", position: "a1" },
      { id: "c", position: "a0" },
    ].sort(byPosition);
    expect(sorted.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });
});
