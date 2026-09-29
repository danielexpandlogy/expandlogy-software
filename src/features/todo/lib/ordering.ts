import { generateKeyBetween } from "fractional-indexing";

/** Algo con clave de orden fraccionaria (secciones, tareas, subtareas). */
export interface Positioned {
  id: string;
  position: string;
}

/** Orden estable: por posición y, ante empate (inserciones simultáneas), por id. */
export function byPosition(a: Positioned, b: Positioned) {
  if (a.position !== b.position) return a.position < b.position ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Clave entre dos vecinos. Tolera vecinos con la misma clave (dos inserciones
 * concurrentes): en ese caso coloca el ítem justo después de `before`.
 */
export function positionBetween(before?: string | null, after?: string | null): string {
  const a = before ?? null;
  const b = after ?? null;
  if (a !== null && b !== null && a >= b) return generateKeyBetween(a, null);
  return generateKeyBetween(a, b);
}

/** Clave para añadir al final de una lista (ordenada o no). */
export function positionAtEnd(items: Positioned[]): string {
  const last = items.reduce<string | null>((max, i) => (max === null || i.position > max ? i.position : max), null);
  return generateKeyBetween(last, null);
}

/**
 * Clave para que `movingId` quede en el índice `index` de `list`, donde `list`
 * es el orden final deseado (ya incluye al ítem que se mueve en ese índice).
 */
export function positionForIndex(list: Positioned[], index: number, movingId: string): string {
  const others = list.filter((i) => i.id !== movingId);
  const before = others[index - 1]?.position ?? null;
  const after = others[index]?.position ?? null;
  return positionBetween(before, after);
}
