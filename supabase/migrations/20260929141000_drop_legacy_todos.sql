-- To-do List · Sprint 7: se retira la To-do List anterior. Sus datos se
-- migraron a tasks en el Sprint 1 (20260929100000_todo_boards.sql).
drop table if exists public.todos;

-- set_todo_completed_at se conserva: la usa el trigger tasks_set_completed_at.
-- El enum todo_priority también (tasks.priority).
comment on function public.set_todo_completed_at() is
  'Mantiene completed_at al marcar o desmarcar completed. Usada por tasks_set_completed_at.';
