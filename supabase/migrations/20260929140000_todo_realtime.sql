-- To-do List · Sprint 7: cambios en vivo entre quienes ven el mismo tablero.
-- Realtime aplica la RLS de cada tabla: un usuario sin acceso no recibe filas.
alter publication supabase_realtime add table public.sections, public.tasks, public.task_comments;
