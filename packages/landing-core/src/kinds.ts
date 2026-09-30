/**
 * Tipos de variable: el contrato entre el panel y las landings. Cada tipo fija
 * la forma del `value` de sus opciones. El panel valida con `validateValue` al
 * guardar y la landing lee con `read*` (un valor inválido devuelve null y la
 * landing muestra su versión original).
 */

export type VariableKind = "headline" | "text" | "image" | "cta" | "color" | "order";

export const VARIABLE_KINDS: readonly VariableKind[] = ["headline", "text", "image", "cta", "color", "order"];

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

type Value = Record<string, unknown>;

const str = (v: unknown, max = 400): string | null => (typeof v === "string" && v.length <= max ? v : null);

/** Titular con una parte resaltada: before + highlight + after. */
export interface HeadlineValue {
  before: string;
  highlight: string;
  after: string;
}

export function readHeadline(value: Value): HeadlineValue | null {
  const before = str(value.before);
  const highlight = str(value.highlight);
  const after = str(value.after);
  if (before === null || highlight === null || after === null || !(before + highlight + after).trim()) return null;
  return { before, highlight, after };
}

/** Un texto libre (subtítulo, párrafo, etiqueta…). */
export function readText(value: Value): string | null {
  const text = str(value.text, 2000);
  return text?.trim() ? text : null;
}

export interface ImageValue {
  src: string;
  alt: string;
}

export function readImage(value: Value): ImageValue | null {
  const src = str(value.src, 2000);
  if (!src || !/^https:\/\/\S+$/.test(src)) return null;
  return { src, alt: str(value.alt) ?? "" };
}

/** Texto de un botón y su subtítulo opcional. */
export interface CtaValue {
  label: string;
  sub: string;
}

export function readCta(value: Value): CtaValue | null {
  const label = str(value.label, 60);
  if (!label?.trim()) return null;
  return { label, sub: str(value.sub, 80) ?? "" };
}

/** Color y color al pasar el mouse (si falta, se usa el mismo). */
export interface ColorValue {
  color: string;
  hover: string;
}

export function readColor(value: Value): ColorValue | null {
  const color = str(value.color);
  if (!color || !HEX_COLOR.test(color)) return null;
  const hover = str(value.hover);
  return { color, hover: hover && HEX_COLOR.test(hover) ? hover : color };
}

/** Orden válido: keys conocidas sin repetir; las que falten se agregan al final. */
export function readOrder<K extends string>(value: Value, keys: readonly K[]): K[] | null {
  if (!Array.isArray(value.order)) return null;
  const known = value.order.filter((k): k is K => (keys as readonly string[]).includes(k));
  const unique = [...new Set(known)];
  if (unique.length === 0) return null;
  return [...unique, ...keys.filter((k) => !unique.includes(k))];
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

/** Error legible si el valor no sirve para ese tipo; null si está bien. */
export function validateValue(kind: VariableKind, value: Value, sectionKeys: string[]): string | null {
  switch (kind) {
    case "headline": {
      const full = text(value.before) + text(value.highlight) + text(value.after);
      if (!full.trim()) return "Escribe el titular.";
      if (full.length > 400) return "El titular es demasiado largo.";
      return null;
    }
    case "text":
      if (!text(value.text).trim()) return "Escribe el texto.";
      if (text(value.text).length > 2000) return "El texto debe tener 2000 caracteres o menos.";
      return null;
    case "image":
      if (!/^https:\/\/\S+$/.test(text(value.src))) return "La imagen necesita una URL que empiece con https://";
      if (!text(value.alt).trim()) return "Describe la imagen (texto alternativo).";
      return null;
    case "cta":
      if (!text(value.label).trim()) return "Escribe el texto del botón.";
      if (text(value.label).length > 60) return "El texto del botón debe tener 60 caracteres o menos.";
      if (text(value.sub).length > 80) return "El subtítulo debe tener 80 caracteres o menos.";
      return null;
    case "color":
      if (!HEX_COLOR.test(text(value.color))) return "El color debe tener el formato #RRGGBB.";
      if (value.hover && !HEX_COLOR.test(text(value.hover))) return "El color al pasar el mouse debe tener el formato #RRGGBB.";
      return null;
    case "order": {
      const order = Array.isArray(value.order) ? value.order : [];
      const complete = order.length === sectionKeys.length && sectionKeys.every((k) => order.includes(k));
      return complete ? null : "El orden debe incluir todas las secciones una vez.";
    }
  }
}
