-- ─────────────────────────────────────────────────────────────────────────────
-- To-do List · Sprint 5: comentarios en tareas y subtareas.
--
-- Lista PLANA a propósito: no existe parent_comment_id, así que no se puede
-- comentar un comentario ni por la UI ni por la API.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  -- Desnormalizado para RLS y Realtime; lo rellena el trigger, nunca el cliente.
  board_id    uuid not null references public.boards (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null default auth.uid(),
  body        text not null default '' check (char_length(body) <= 5000),
  edited_at   timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.task_comments is
  'Comentarios de tareas y subtareas. Lista plana: sin parent_comment_id a propósito (no se responden comentarios).';

create index task_comments_task_created_idx on public.task_comments (task_id, created_at desc);
create index task_comments_board_idx on public.task_comments (board_id);

create or replace function public.task_comments_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select board_id into new.board_id from public.tasks where id = new.task_id;
  if new.board_id is null then
    raise exception 'La tarea no existe';
  end if;
  new.created_at := now();
  new.edited_at := null;
  return new;
end;
$$;

create trigger task_comments_set_board
  before insert on public.task_comments
  for each row execute function public.task_comments_before_insert();

-- Sólo cambia el texto; autor, tarea, tablero y fecha son inmutables.
create or replace function public.task_comments_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.author_id is distinct from old.author_id
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

create trigger task_comments_guard_update
  before update on public.task_comments
  for each row execute function public.task_comments_before_update();

alter table public.task_comments enable row level security;

create policy "task_comments: ver" on public.task_comments
  for select to authenticated using (public.can_access_board(board_id));

-- Sin política de insert: se crean sólo con create_comment (valida y, en el
-- Sprint 6, inserta los adjuntos en la misma transacción).

create policy "task_comments: el autor edita" on public.task_comments
  for update to authenticated
  using (author_id = auth.uid() and public.can_access_board(board_id))
  with check (author_id = auth.uid() and public.can_access_board(board_id));

create policy "task_comments: el autor o un admin borra" on public.task_comments
  for delete to authenticated
  using ((author_id = auth.uid() or public.is_admin()) and public.can_access_board(board_id));

revoke all on public.task_comments from anon;

create or replace function public.create_comment(p_task_id uuid, p_body text, p_attachments jsonb default '[]'::jsonb)
returns public.task_comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board_id uuid;
  v_body text := coalesce(trim(p_body), '');
  v_comment public.task_comments;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  select board_id into v_board_id from public.tasks where id = p_task_id;
  if v_board_id is null or not public.can_access_board(v_board_id) then
    raise exception 'La tarea no existe o no tienes acceso';
  end if;
  if char_length(v_body) > 5000 then
    raise exception 'El comentario supera los 5000 caracteres';
  end if;
  -- Sprint 5: sólo texto. El Sprint 6 permite comentarios sólo con adjuntos.
  if v_body = '' then
    raise exception 'El comentario está vacío';
  end if;

  insert into public.task_comments (task_id, author_id, body)
  values (p_task_id, auth.uid(), v_body)
  returning * into v_comment;
  return v_comment;
end;
$$;

revoke execute on function public.create_comment(uuid, text, jsonb) from public, anon;
grant execute on function public.create_comment(uuid, text, jsonb) to authenticated;

-- board_people también debe incluir a quien comentó (p. ej. un exmiembro).
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
      or exists (select 1 from public.task_comments c where c.board_id = p_board_id and c.author_id = p.id)
    );
$$;
