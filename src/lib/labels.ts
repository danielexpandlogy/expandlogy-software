import type { AppRole, TodoPriority } from "./database.types";

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  user: "Usuario",
};

export const PRIORITIES: TodoPriority[] = ["high", "medium", "low"];

export const PRIORITY_LABEL: Record<TodoPriority, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

/**
 * Color de la bandera de prioridad (rojo, naranja, azul). Todos superan 3:1
 * sobre blanco, el mínimo para iconos; el texto de la etiqueta va en gris.
 */
export const PRIORITY_FLAG: Record<TodoPriority, string> = {
  high: "text-[hsl(0_72%_45%)]",
  medium: "text-[hsl(28_92%_42%)]",
  low: "text-[hsl(217_85%_50%)]",
};

/** Mismo color como fondo (barras del Home). */
export const PRIORITY_BG: Record<TodoPriority, string> = {
  high: "bg-[hsl(0_72%_45%)]",
  medium: "bg-[hsl(28_92%_42%)]",
  low: "bg-[hsl(217_85%_50%)]",
};

export function initials(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function displayName(name: string, email: string) {
  return name.trim() || email.split("@")[0];
}
