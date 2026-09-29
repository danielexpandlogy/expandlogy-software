import { describe, expect, it } from "vitest";
import type { Task } from "./database.types";
import { completedPerDay, isOverdue, todoStats, upcoming } from "./todo-stats";

const NOW = new Date(2026, 8, 28, 10, 0); // 28 sep 2026, hora local

const todo = (overrides: Partial<Task>): Task => ({
  id: crypto.randomUUID(),
  board_id: "b1",
  section_id: "s1",
  parent_id: null,
  title: "Tarea",
  description: "",
  reminder_at: null,
  position: "a0",
  created_by: "u1",
  updated_at: NOW.toISOString(),
  priority: "medium",
  due_date: null,
  completed: false,
  completed_at: null,
  created_at: NOW.toISOString(),
  ...overrides,
});

describe("isOverdue", () => {
  it("vence el día siguiente a la fecha límite, no el mismo día", () => {
    expect(isOverdue(todo({ due_date: "2026-09-28" }), NOW)).toBe(false);
    expect(isOverdue(todo({ due_date: "2026-09-27" }), NOW)).toBe(true);
  });

  it("una tarea completada nunca está vencida", () => {
    expect(isOverdue(todo({ due_date: "2026-01-01", completed: true }), NOW)).toBe(false);
  });
});

describe("todoStats", () => {
  it("cuenta pendientes, completadas, vencidas y porcentaje", () => {
    const stats = todoStats(
      [todo({ completed: true }), todo({}), todo({ due_date: "2026-09-01" }), todo({ completed: true })],
      NOW,
    );
    expect(stats).toEqual({ total: 4, completed: 2, pending: 2, overdue: 1, rate: 50 });
  });

  it("sin tareas el progreso es 0", () => {
    expect(todoStats([], NOW).rate).toBe(0);
  });
});

describe("completedPerDay", () => {
  it("agrupa por día local los últimos 7 días e ignora los anteriores", () => {
    const days = completedPerDay(
      [
        todo({ completed: true, completed_at: new Date(2026, 8, 28, 9).toISOString() }),
        todo({ completed: true, completed_at: new Date(2026, 8, 28, 8).toISOString() }),
        todo({ completed: true, completed_at: new Date(2026, 8, 22, 12).toISOString() }),
        todo({ completed: true, completed_at: new Date(2026, 8, 21, 12).toISOString() }),
      ],
      7,
      NOW,
    );
    expect(days).toHaveLength(7);
    expect(days[0].key).toBe("2026-09-22");
    expect(days[0].count).toBe(1);
    expect(days[6].count).toBe(2);
    expect(days.reduce((s, d) => s + d.count, 0)).toBe(3);
  });
});

describe("upcoming", () => {
  it("prioriza fecha más próxima, luego con fecha, luego prioridad", () => {
    const list = upcoming([
      todo({ title: "sin fecha baja", priority: "low" }),
      todo({ title: "sin fecha alta", priority: "high" }),
      todo({ title: "tarde", due_date: "2026-10-10" }),
      todo({ title: "pronto", due_date: "2026-09-29" }),
      todo({ title: "hecha", due_date: "2026-09-01", completed: true }),
    ]);
    expect(list.map((t) => t.title)).toEqual(["pronto", "tarde", "sin fecha alta", "sin fecha baja"]);
  });
});
