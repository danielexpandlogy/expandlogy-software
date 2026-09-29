-- Conteo de comentarios por tarea para las tarjetas del tablero. Agrupado en SQL:
-- contar filas en el cliente chocaría con el límite de filas de la API (1000).
-- security invoker: aplica la RLS de task_comments de quien consulta.
create or replace function public.task_comment_counts(p_board_id uuid)
returns table (task_id uuid, count bigint)
language sql
stable
set search_path = ''
as $$
  select c.task_id, count(*) from public.task_comments c where c.board_id = p_board_id group by c.task_id;
$$;

revoke execute on function public.task_comment_counts(uuid) from public, anon;
grant execute on function public.task_comment_counts(uuid) to authenticated;
