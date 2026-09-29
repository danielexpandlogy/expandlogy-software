-- To-do List · Sprint 4: personas visibles en un tablero.
--
-- La RLS de profiles sólo deja ver el perfil propio (o todos, a un admin). En un
-- tablero hay que mostrar quién creó una tarea o escribió un comentario, que
-- puede ser un admin u otro miembro. En lugar de abrir profiles a todos, esta
-- función devuelve sólo nombre y email de las personas relevantes para ese
-- tablero, y sólo a quien tiene acceso a él.
create or replace function public.board_people(p_board_id uuid)
returns table (id uuid, full_name text, email text, role public.app_role)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.email, p.role
  from public.profiles p
  where public.can_access_board(p_board_id)
    and (
      p.role = 'admin'
      or exists (select 1 from public.board_members m where m.board_id = p_board_id and m.user_id = p.id)
      or exists (select 1 from public.tasks t where t.board_id = p_board_id and t.created_by = p.id)
    );
$$;

revoke execute on function public.board_people(uuid) from public, anon;
grant execute on function public.board_people(uuid) to authenticated;
