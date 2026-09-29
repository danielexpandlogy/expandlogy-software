-- Corrige task_comments_before_update (20260929120000): borrar un usuario pone
-- author_id en NULL (on delete set null) y el trigger lo trataba como un cambio
-- de autor prohibido, abortando el borrado. Resultado: no se podía eliminar a
-- nadie que hubiera comentado. Ahora se permite exactamente ese caso.
create or replace function public.task_comments_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.author_id is distinct from old.author_id and new.author_id is not null)
     or new.task_id is distinct from old.task_id
     or new.board_id is distinct from old.board_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Sólo se puede editar el texto del comentario';
  end if;
  if new.body is distinct from old.body then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;
