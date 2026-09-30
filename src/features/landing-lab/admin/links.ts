import type { LpVariable } from "@/lib/database.types";

/** URL completa: las /rutas son de esta misma app; lo demás ya es https://… */
export function absoluteUrl(url: string): string {
  return url.startsWith("/") ? `${window.location.origin}${url}` : url;
}

/** La URL de la landing con parámetros agregados (p. ej. lp_preview). */
export function withParams(url: string, params: Record<string, string>): string {
  const u = new URL(absoluteUrl(url));
  Object.entries(params).forEach(([key, value]) => u.searchParams.set(key, value));
  return u.toString();
}

/** Nombre legible de cada sección de una variable 'order', por key. */
export function sectionLabels(variable: Pick<LpVariable, "config">): Record<string, string> {
  return Object.fromEntries((variable.config?.sections ?? []).map((s) => [s.key, s.label]));
}

/** "Mi Landing Nueva" → "mi-landing-nueva" (landing) o "mi_landing_nueva" (variable). */
export function slugify(text: string, separator: "-" | "_" = "-"): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, "g"), "")
    .slice(0, 40);
}
