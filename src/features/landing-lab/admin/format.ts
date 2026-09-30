import type { Phase, VariableKind } from "@danielexpandlogy/landing-core";

const nf = new Intl.NumberFormat("es-MX");

export const num = (n: number) => nf.format(n);

/** Porcentaje con un decimal (0.0532 → "5.3%"). */
export const pct = (ratio: number, digits = 1) => `${(ratio * 100).toFixed(digits)}%`;

/** Tasa x/total, o "—" sin datos. */
export const rate = (x: number, total: number) => (total > 0 ? pct(x / total) : "—");

/** Etiqueta y colores de cada fase de una variable. */
export const PHASE_BADGE: Record<Phase, { label: string; className: string }> = {
  off: { label: "Apagada", className: "bg-secondary text-muted-foreground" },
  fixed: { label: "Ganador fijado", className: "bg-success/15 text-success" },
  single: { label: "Falta una opción", className: "bg-warning/15 text-warning" },
  exploring: { label: "Explorando", className: "bg-primary/10 text-primary" },
  optimizing: { label: "Priorizando", className: "bg-primary/10 text-primary" },
  ready: { label: "Ganador listo", className: "bg-success/15 text-success" },
};

/** Nombre de cada tipo de variable en el panel. */
export const KIND_LABELS: Record<VariableKind, { label: string; hint: string }> = {
  headline: { label: "Titular con resaltado", hint: "Texto antes, parte resaltada y texto después." },
  text: { label: "Texto", hint: "Un texto libre: subtítulo, párrafo, etiqueta…" },
  image: { label: "Imagen", hint: "URL https:// y texto alternativo." },
  cta: { label: "Botón", hint: "Texto del botón y subtítulo opcional." },
  color: { label: "Color", hint: "Color y color al pasar el mouse." },
  order: { label: "Orden de secciones", hint: "En qué orden aparecen las secciones." },
};

/** Valor vacío de cada tipo, para la opción original de una variable nueva. */
export function emptyValue(kind: VariableKind, accent: string, sectionKeys: string[]): Record<string, unknown> {
  switch (kind) {
    case "headline":
      return { before: "", highlight: "", after: "" };
    case "text":
      return { text: "" };
    case "image":
      return { src: "", alt: "" };
    case "cta":
      return { label: "", sub: "" };
    case "color":
      return { color: accent, hover: accent };
    case "order":
      return { order: sectionKeys };
  }
}
