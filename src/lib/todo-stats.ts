import { addDays, format, isBefore, parseISO, startOfDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import type { TodoPriority } from "./database.types";

/** Lo mínimo que necesitan las estadísticas (lo cumple `Task`). */
export interface StatTask {
  completed: boolean;
  completed_at: string | null;
  due_date: string | null;
  priority: TodoPriority;
}

/** due_date es una fecha sin hora: se interpreta en la zona local. */
export const parseDueDate = (d: string) => parseISO(d);

export function isOverdue(todo: StatTask, now = new Date()) {
  return !todo.completed && !!todo.due_date && isBefore(parseDueDate(todo.due_date), startOfDay(now));
}

export function todoStats(todos: StatTask[], now = new Date()) {
  const completed = todos.filter((t) => t.completed).length;
  const pending = todos.length - completed;
  const overdue = todos.filter((t) => isOverdue(t, now)).length;
  const rate = todos.length ? Math.round((completed / todos.length) * 100) : 0;
  return { total: todos.length, completed, pending, overdue, rate };
}

/** Tareas completadas por día en los últimos `days` días (incluido hoy). */
export function completedPerDay(todos: StatTask[], days = 7, now = new Date()) {
  const start = startOfDay(subDays(now, days - 1));
  const buckets = Array.from({ length: days }, (_, i) => {
    const day = addDays(start, i);
    return { key: format(day, "yyyy-MM-dd"), label: format(day, "EEE", { locale: es }), count: 0 };
  });
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const t of todos) {
    if (!t.completed_at) continue;
    const i = index.get(format(new Date(t.completed_at), "yyyy-MM-dd"));
    if (i !== undefined) buckets[i].count++;
  }
  return buckets;
}

/** Pendientes ordenadas: vencidas y con fecha primero, luego por prioridad. */
export function upcoming<T extends StatTask>(todos: T[], limit = 5): T[] {
  const weight = { high: 0, medium: 1, low: 2 } as const;
  return todos
    .filter((t) => !t.completed)
    .sort((a, b) => {
      if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
      if (!!a.due_date !== !!b.due_date) return a.due_date ? -1 : 1;
      return weight[a.priority] - weight[b.priority];
    })
    .slice(0, limit);
}
