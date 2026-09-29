import type { Board, Section, Task } from "@/lib/database.types";
import { byPosition } from "./ordering";

export interface BoardData {
  board: Board;
  sections: Section[];
  /** Tareas y subtareas del tablero, sin orden garantizado. */
  tasks: Task[];
  /** Comentarios por tarea (Sprint 5). */
  commentCounts: Record<string, number>;
}

export const topLevel = (tasks: Task[]) => tasks.filter((t) => t.parent_id === null);

/** Tareas de nivel superior agrupadas por sección, ordenadas. */
export function tasksBySection(tasks: Task[], opts: { showCompleted?: boolean } = {}) {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.parent_id !== null || t.section_id === null) continue;
    if (!opts.showCompleted && t.completed) continue;
    const list = map.get(t.section_id);
    if (list) list.push(t);
    else map.set(t.section_id, [t]);
  }
  for (const list of map.values()) list.sort(byPosition);
  return map;
}

/** Subtareas agrupadas por tarea padre, ordenadas. */
export function subtasksByParent(tasks: Task[]) {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.parent_id === null) continue;
    const list = map.get(t.parent_id);
    if (list) list.push(t);
    else map.set(t.parent_id, [t]);
  }
  for (const list of map.values()) list.sort(byPosition);
  return map;
}

export function subtaskProgress(subtasks: Task[] | undefined) {
  if (!subtasks?.length) return null;
  return { done: subtasks.filter((s) => s.completed).length, total: subtasks.length };
}

/**
 * Búsqueda dentro del tablero: una tarea queda si su título o descripción
 * coincide, o si coincide alguna de sus subtareas (que se conservan todas).
 */
export function filterTasks(tasks: Task[], query: string): Task[] {
  const q = query.trim().toLocaleLowerCase("es");
  if (!q) return tasks;
  const hit = (t: Task) => t.title.toLocaleLowerCase("es").includes(q) || t.description.toLocaleLowerCase("es").includes(q);
  const keep = new Set<string>();
  for (const t of tasks) {
    if (!hit(t)) continue;
    keep.add(t.parent_id ?? t.id);
  }
  return tasks.filter((t) => keep.has(t.parent_id ?? t.id));
}
