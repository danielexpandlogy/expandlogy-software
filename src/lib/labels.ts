import type { AppRole, TodoPriority } from "./database.types";

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  user: "Usuario",
};

export const PRIORITY_LABEL: Record<TodoPriority, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export const PRIORITY_CLASS: Record<TodoPriority, string> = {
  high: "bg-destructive/10 text-destructive",
  // Ámbar oscuro: el tono de --warning no llega a 4.5:1 como texto.
  medium: "bg-warning/15 text-[hsl(28_90%_30%)]",
  low: "bg-muted text-muted-foreground",
};

export function initials(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function displayName(name: string, email: string) {
  return name.trim() || email.split("@")[0];
}
