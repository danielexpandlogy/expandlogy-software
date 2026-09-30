/**
 * Motor estadístico del Landing Lab. Cada opción es una tasa de agenda con
 * posterior Beta(1 + agendas, 1 + visitantes − agendas); con eso se calcula la
 * probabilidad de que cada opción sea la mejor (Monte Carlo) y el reparto de
 * tráfico. La landing y el panel usan exactamente las mismas funciones (y la
 * misma semilla), así que el panel muestra el reparto real.
 */

export interface OptionCounts {
  id: string;
  visitors: number;
  conversions: number;
}

export interface BanditSettings {
  auto_optimize: boolean;
  min_visitors_per_option: number;
  min_conversions_to_win: number;
  win_probability: number;
  traffic_floor: number;
}

export type Rng = () => number;

/** PRNG determinista (mulberry32): mismos datos → mismos números en landing y panel. */
export function seededRng(seed = 0x9e3779b9): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rng: Rng): number {
  // Box-Muller; 1 - rng() evita log(0).
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}

/** Gamma(shape, 1) por Marsaglia-Tsang. */
function gamma(shape: number, rng: Rng): number {
  if (shape < 1) return gamma(shape + 1, rng) * Math.pow(rng(), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function sampleBeta(alpha: number, beta: number, rng: Rng): number {
  const x = gamma(alpha, rng);
  return x / (x + gamma(beta, rng));
}

const posterior = (o: OptionCounts): [number, number] => {
  const conv = Math.min(o.conversions, o.visitors);
  return [1 + conv, 1 + o.visitors - conv];
};

/** Probabilidad de que cada opción tenga la mayor tasa de agenda real. */
export function probabilityBest(options: OptionCounts[], draws = 4000, rng: Rng = seededRng()): number[] {
  if (options.length === 0) return [];
  if (options.length === 1) return [1];
  const wins = new Array(options.length).fill(0);
  const params = options.map(posterior);
  for (let i = 0; i < draws; i++) {
    let best = 0;
    let bestValue = -1;
    params.forEach(([a, b], j) => {
      const value = sampleBeta(a, b, rng);
      if (value > bestValue) {
        bestValue = value;
        best = j;
      }
    });
    wins[best]++;
  }
  return wins.map((w) => w / draws);
}

/** Intervalo creíble del 95% de la tasa de agenda. */
export function credibleInterval(o: OptionCounts, draws = 2000, rng: Rng = seededRng()): [number, number] {
  const [a, b] = posterior(o);
  const samples = Array.from({ length: draws }, () => sampleBeta(a, b, rng)).sort((x, y) => x - y);
  return [samples[Math.floor(draws * 0.025)], samples[Math.floor(draws * 0.975)]];
}

export type Phase = "off" | "fixed" | "single" | "exploring" | "optimizing" | "ready";

export interface VariableAnalysis {
  phase: Phase;
  /** Por opción activa, en el mismo orden que `options`. */
  probBest: number[];
  shares: number[];
  bestIndex: number;
  /** Visitantes de la opción activa con menos datos (progreso de la exploración). */
  minVisitors: number;
}

/**
 * Fase y reparto de una variable a partir de sus opciones ACTIVAS.
 * - Exploración: reparto parejo hasta que todas tengan `min_visitors_per_option`.
 * - Priorización: reparto = piso + (resto × probabilidad de ser la mejor).
 * - Ganador listo: la mejor supera `win_probability` y `min_conversions_to_win`.
 */
export function analyzeVariable(
  options: OptionCounts[],
  settings: BanditSettings,
  flags: { enabled: boolean; fixed: boolean },
): VariableAnalysis {
  const n = options.length;
  const uniform = new Array(n).fill(n ? 1 / n : 0);
  const probBest = probabilityBest(options);
  const bestIndex = probBest.reduce((best, p, i) => (p > probBest[best] ? i : best), 0);
  const minVisitors = n ? Math.min(...options.map((o) => o.visitors)) : 0;
  const base = { probBest, bestIndex, minVisitors };

  if (!flags.enabled) return { ...base, phase: "off", shares: uniform };
  if (flags.fixed) return { ...base, phase: "fixed", shares: uniform };
  if (n < 2) return { ...base, phase: "single", shares: uniform };
  if (minVisitors < settings.min_visitors_per_option) return { ...base, phase: "exploring", shares: uniform };

  const ready =
    probBest[bestIndex] >= settings.win_probability &&
    options[bestIndex].conversions >= settings.min_conversions_to_win;
  const phase: Phase = ready ? "ready" : "optimizing";
  if (!settings.auto_optimize) return { ...base, phase, shares: uniform };

  const floor = Math.max(0, settings.traffic_floor);
  if (floor * n >= 1) return { ...base, phase, shares: uniform };
  const shares = probBest.map((p) => floor + (1 - floor * n) * p);
  return { ...base, phase, shares };
}

/** Elige un índice según el reparto (la suma de `shares` debe ser ~1). */
export function pickIndex(shares: number[], random: number = Math.random()): number {
  let acc = 0;
  for (let i = 0; i < shares.length; i++) {
    acc += shares[i];
    if (random < acc) return i;
  }
  return shares.length - 1;
}

/**
 * Visitantes por opción para detectar una mejora relativa `lift` sobre una tasa
 * base `baseRate` (prueba de dos proporciones, 95% de confianza, 80% de potencia).
 */
export function visitorsPerOption(baseRate: number, lift: number): number {
  const p1 = baseRate;
  const p2 = baseRate * (1 + lift);
  if (p1 <= 0 || p2 >= 1 || lift <= 0) return Infinity;
  const z = 1.959964 + 0.841621;
  return Math.ceil((z * z * (p1 * (1 - p1) + p2 * (1 - p2))) / (p2 - p1) ** 2);
}
