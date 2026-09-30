import { describe, expect, it } from "vitest";
import {
  analyzeVariable,
  credibleInterval,
  pickIndex,
  probabilityBest,
  sampleBeta,
  seededRng,
  visitorsPerOption,
  type BanditSettings,
} from "./bandit";

const settings: BanditSettings = {
  auto_optimize: true,
  min_visitors_per_option: 300,
  min_conversions_to_win: 30,
  win_probability: 0.95,
  traffic_floor: 0.1,
};
const on = { enabled: true, fixed: false };
const opt = (id: string, visitors: number, conversions: number) => ({ id, visitors, conversions });

describe("sampleBeta", () => {
  it("tiene la media esperada", () => {
    const rng = seededRng(1);
    const n = 20000;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += sampleBeta(6, 94, rng);
    expect(sum / n).toBeCloseTo(0.06, 2);
  });

  it("funciona con parámetros menores a 1", () => {
    const rng = seededRng(2);
    const x = sampleBeta(0.5, 0.5, rng);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(1);
  });
});

describe("probabilityBest", () => {
  it("suma 1 y favorece a la mejor", () => {
    const p = probabilityBest([opt("a", 1000, 50), opt("b", 1000, 90)]);
    expect(p[0] + p[1]).toBeCloseTo(1, 5);
    expect(p[1]).toBeGreaterThan(0.99);
  });

  it("sin datos, reparte parejo", () => {
    const p = probabilityBest([opt("a", 0, 0), opt("b", 0, 0), opt("c", 0, 0)]);
    p.forEach((x) => expect(x).toBeCloseTo(1 / 3, 1));
  });

  it("es determinista con la semilla por defecto", () => {
    const data = [opt("a", 400, 20), opt("b", 400, 26)];
    expect(probabilityBest(data)).toEqual(probabilityBest(data));
  });
});

describe("credibleInterval", () => {
  it("contiene la tasa observada", () => {
    const [lo, hi] = credibleInterval(opt("a", 1000, 50));
    expect(lo).toBeLessThan(0.05);
    expect(hi).toBeGreaterThan(0.05);
    expect(hi - lo).toBeLessThan(0.03);
  });
});

describe("analyzeVariable", () => {
  it("explora con reparto parejo mientras falten visitas", () => {
    const r = analyzeVariable([opt("a", 299, 30), opt("b", 1000, 5)], settings, on);
    expect(r.phase).toBe("exploring");
    expect(r.shares).toEqual([0.5, 0.5]);
    expect(r.minVisitors).toBe(299);
  });

  it("prioriza respetando el piso de tráfico", () => {
    const r = analyzeVariable([opt("a", 400, 20), opt("b", 400, 28), opt("c", 400, 16)], settings, on);
    expect(r.phase).toBe("optimizing");
    expect(r.shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    r.shares.forEach((s) => expect(s).toBeGreaterThanOrEqual(0.1));
    expect(r.bestIndex).toBe(1);
    expect(r.shares[1]).toBeGreaterThan(r.shares[0]);
  });

  it("declara ganador listo con probabilidad y agendas suficientes", () => {
    const r = analyzeVariable([opt("a", 1500, 60), opt("b", 1500, 110)], settings, on);
    expect(r.phase).toBe("ready");
    expect(r.bestIndex).toBe(1);
  });

  it("no declara ganador sin las agendas mínimas", () => {
    const r = analyzeVariable([opt("a", 2000, 2), opt("b", 2000, 20)], settings, on);
    expect(r.phase).toBe("optimizing");
  });

  it("sin autooptimización, reparte parejo aunque haya ganador", () => {
    const r = analyzeVariable([opt("a", 1500, 60), opt("b", 1500, 110)], { ...settings, auto_optimize: false }, on);
    expect(r.phase).toBe("ready");
    expect(r.shares).toEqual([0.5, 0.5]);
  });

  it("apagada, fijada o con una sola opción", () => {
    expect(analyzeVariable([opt("a", 0, 0), opt("b", 0, 0)], settings, { enabled: false, fixed: false }).phase).toBe("off");
    expect(analyzeVariable([opt("a", 0, 0), opt("b", 0, 0)], settings, { enabled: true, fixed: true }).phase).toBe("fixed");
    expect(analyzeVariable([opt("a", 0, 0)], settings, on).phase).toBe("single");
  });
});

describe("pickIndex", () => {
  it("elige según los tramos del reparto", () => {
    expect(pickIndex([0.2, 0.5, 0.3], 0.1)).toBe(0);
    expect(pickIndex([0.2, 0.5, 0.3], 0.69)).toBe(1);
    expect(pickIndex([0.2, 0.5, 0.3], 0.99)).toBe(2);
  });
});

describe("visitorsPerOption", () => {
  it("coincide con las cifras de referencia (5% base)", () => {
    expect(visitorsPerOption(0.05, 1)).toBeCloseTo(432, -1);
    expect(visitorsPerOption(0.05, 0.5)).toBeCloseTo(1470, -1);
    expect(visitorsPerOption(0.05, 0.3)).toBeCloseTo(3780, -1);
  });

  it("es infinito con entradas imposibles", () => {
    expect(visitorsPerOption(0, 0.5)).toBe(Infinity);
    expect(visitorsPerOption(0.05, 0)).toBe(Infinity);
  });
});
