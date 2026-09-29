-- ─────────────────────────────────────────────────────────────────────────────
-- To-do List · Sprint 1: tableros, miembros, secciones y tareas (con subtareas).
-- Ver Features/To-do List/00-documento-maestro.md §6–§7.
-- ─────────────────────────────────────────────────────────────────────────────

-- Claves de orden compatibles con el paquete `fractional-indexing` del cliente:
-- 'a0'…'az' (62 valores) y luego 'b00'…'bzz'. Sólo se usa para generar posiciones
-- iniciales en SQL (secciones por defecto y migración de datos); el cliente
-- genera el resto con generateKeyBetween.
create or replace function public.order_key(i integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when i < 62 then 'a' || substr(d, i + 1, 1)
    else 'b' || substr(d, ((i - 62) / 62) + 1, 1) || substr(d, ((i - 62) % 62) + 1, 1)
  end
  from (select '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'::text as d) digits;
$$;

revoke execute on function public.order_key(integer) from public, anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── Tablas ──────────────────────────────────────────────────────────────────

create table public.boards (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(trim(name)) between 1 and 120),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Un tablero activo por usuario (P1 del maestro: los tableros los crea un admin).
create unique index boards_one_active_per_owner on public.boards (owner_id) where archived_at is null;

create table public.board_members (
  board_id    uuid not null references public.boards (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  added_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (board_id, user_id)
);

create index board_members_user_id_idx on public.board_members (user_id);

create table public.sections (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 120),
  position    text collate "C" not null,
  created_at  timestamptz not null default now()
);

create index sections_board_position_idx on public.sections (board_id, position);

create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  board_id      uuid not null references public.boards (id) on delete cascade,
  section_id    uuid references public.sections (id) on delete cascade,
  parent_id     uuid references public.tasks (id) on delete cascade,
  title         text not null check (char_length(trim(title)) between 1 and 500),
  description   text not null default '' check (char_length(description) <= 20000),
  priority      public.todo_priority not null default 'medium',
  due_date      date,
  -- Beta: se guarda, pero ningún proceso envía notificaciones todavía.
  reminder_at   timestamptz,
  completed     boolean not null default false,
  completed_at  timestamptz,
  position      text collate "C" not null,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Las tareas viven en una sección; las subtareas heredan la de su padre.
  constraint tasks_section_xor_parent check ((parent_id is null) = (section_id is not null))
);

create index tasks_section_position_idx on public.tasks (section_id, position) where parent_id is null;
create index tasks_parent_position_idx on public.tasks (parent_id, position) where parent_id is not null;
create index tasks_board_id_idx on public.tasks (board_id);

-- ── Integridad de tareas ────────────────────────────────────────────────────

-- Subtareas de un solo nivel, siempre en el tablero de su padre; la sección
-- pertenece al mismo tablero; una tarea no cambia de tablero.
create or replace function public.guard_task_hierarchy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent public.tasks%rowtype;
begin
  if tg_op = 'UPDATE' and new.board_id <> old.board_id then
    raise exception 'Una tarea no puede cambiar de tablero';
  end if;

  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Una tarea no puede ser su propia subtarea';
    end if;
    select * into v_parent from public.tasks where id = new.parent_id;
    if not found then
      raise exception 'La tarea padre no existe';
    end if;
    if v_parent.parent_id is not null then
      raise exception 'Las subtareas no pueden tener subtareas';
    end if;
    if v_parent.board_id <> new.board_id then
      raise exception 'La subtarea debe estar en el tablero de su tarea padre';
    end if;
    if exists (select 1 from public.tasks where parent_id = new.id) then
      raise exception 'Una tarea con subtareas no puede convertirse en subtarea';
    end if;
  end if;

  if new.section_id is not null
     and not exists (select 1 from public.sections where id = new.section_id and board_id = new.board_id) then
    raise exception 'La sección no pertenece a este tablero';
  end if;

  return new;
end;
$$;

create trigger tasks_guard_hierarchy
  before insert or update of parent_id, section_id, board_id on public.tasks
  for each row execute function public.guard_task_hierarchy();

-- Reutiliza la función de la To-do List anterior: sólo toca completed/completed_at.
create trigger tasks_set_completed_at
  before insert or update of completed on public.tasks
  for each row execute function public.set_todo_completed_at();

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger boards_set_updated_at
  before update on public.boards
  for each row execute function public.set_updated_at();

-- ── Acceso ──────────────────────────────────────────────────────────────────

-- security definer: se llama desde políticas de board_members (evita recursión).
create or replace function public.can_access_board(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.board_members
    where board_id = p_board_id and user_id = auth.uid()
  );
$$;

revoke execute on function public.can_access_board(uuid) from public, anon;
grant execute on function public.can_access_board(uuid) to authenticated;

alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.sections enable row level security;
alter table public.tasks enable row level security;

create policy "boards: ver si tiene acceso" on public.boards
  for select to authenticated using (public.can_access_board(id));
create policy "boards: sólo admin edita" on public.boards
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Sin insert/delete: se crean con create_board_for_user y se archivan.

create policy "board_members: ver si tiene acceso" on public.board_members
  for select to authenticated using (public.can_access_board(board_id));
create policy "board_members: sólo admin añade" on public.board_members
  for insert to authenticated with check (public.is_admin());
create policy "board_members: sólo admin quita" on public.board_members
  for delete to authenticated using (public.is_admin());

create policy "sections: ver" on public.sections
  for select to authenticated using (public.can_access_board(board_id));
create policy "sections: crear" on public.sections
  for insert to authenticated with check (public.can_access_board(board_id));
create policy "sections: editar" on public.sections
  for update to authenticated using (public.can_access_board(board_id)) with check (public.can_access_board(board_id));
create policy "sections: borrar" on public.sections
  for delete to authenticated using (public.can_access_board(board_id));

create policy "tasks: ver" on public.tasks
  for select to authenticated using (public.can_access_board(board_id));
create policy "tasks: crear" on public.tasks
  for insert to authenticated with check (public.can_access_board(board_id));
create policy "tasks: editar" on public.tasks
  for update to authenticated using (public.can_access_board(board_id)) with check (public.can_access_board(board_id));
create policy "tasks: borrar" on public.tasks
  for delete to authenticated using (public.can_access_board(board_id));

revoke all on public.boards, public.board_members, public.sections, public.tasks from anon;

-- ── Alta de un usuario en el To-do List ─────────────────────────────────────

create or replace function public.create_board_for_user(p_user_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Sólo un administrador puede añadir usuarios al To-do List';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'El usuario no existe';
  end if;
  if exists (select 1 from public.boards where owner_id = p_user_id and archived_at is null) then
    raise exception 'Este usuario ya tiene un tablero';
  end if;

  insert into public.boards (name, owner_id, created_by)
  values (trim(p_name), p_user_id, auth.uid())
  returning id into v_board_id;

  insert into public.board_members (board_id, user_id, added_by)
  values (v_board_id, p_user_id, auth.uid());

  insert into public.sections (board_id, name, position)
  values (v_board_id, 'Por hacer', public.order_key(0)),
         (v_board_id, 'En progreso', public.order_key(1)),
         (v_board_id, 'Listo', public.order_key(2));

  return v_board_id;
exception
  -- Dos admins a la vez: el índice único parcial es la garantía final.
  when unique_violation then
    raise exception 'Este usuario ya tiene un tablero';
end;
$$;

revoke execute on function public.create_board_for_user(uuid, text) from public, anon;
grant execute on function public.create_board_for_user(uuid, text) to authenticated;

-- Índice de tableros con conteos, sin N+1. security_invoker: aplica la RLS de
-- quien consulta (un usuario sólo ve el suyo; un admin, todos).
create view public.board_summaries
with (security_invoker = true) as
select
  b.id,
  b.name,
  b.owner_id,
  b.archived_at,
  b.created_at,
  p.full_name as owner_name,
  p.email as owner_email,
  count(t.id) filter (where not t.completed) as pending_count,
  count(t.id) filter (where t.completed) as completed_count
from public.boards b
join public.profiles p on p.id = b.owner_id
left join public.tasks t on t.board_id = b.id and t.parent_id is null
group by b.id, p.id;

revoke all on public.board_summaries from anon;
grant select on public.board_summaries to authenticated;

-- ── Migración de la To-do List anterior ─────────────────────────────────────
-- Idempotente: sólo usuarios con tareas y sin tablero activo. La tabla `todos`
-- se conserva hasta el Sprint 7.
do $$
declare
  r record;
  v_board_id uuid;
  v_section_id uuid;
begin
  for r in
    select distinct t.user_id
    from public.todos t
    join public.profiles p on p.id = t.user_id
    where not exists (select 1 from public.boards b where b.owner_id = t.user_id and b.archived_at is null)
  loop
    insert into public.boards (name, owner_id, created_by)
    values ('Mis tareas', r.user_id, r.user_id)
    returning id into v_board_id;

    insert into public.board_members (board_id, user_id, added_by)
    values (v_board_id, r.user_id, r.user_id);

    insert into public.sections (board_id, name, position)
    values (v_board_id, 'Por hacer', public.order_key(0))
    returning id into v_section_id;

    insert into public.sections (board_id, name, position)
    values (v_board_id, 'En progreso', public.order_key(1)),
           (v_board_id, 'Listo', public.order_key(2));

    -- La lista anterior mostraba lo más nuevo arriba: se conserva ese orden.
    insert into public.tasks (board_id, section_id, title, description, priority, due_date,
                              completed, completed_at, position, created_by, created_at)
    select v_board_id, v_section_id, t.title, t.notes, t.priority, t.due_date,
           t.completed, t.completed_at,
           public.order_key((row_number() over (order by t.created_at desc))::int - 1),
           t.user_id, t.created_at
    from public.todos t
    where t.user_id = r.user_id;
  end loop;
end $$;

-- El trigger tasks_set_completed_at pisa completed_at con now() en el insert;
-- se restaura el valor original de las tareas migradas.
update public.tasks t
set completed_at = o.completed_at
from public.todos o
where t.created_at = o.created_at
  and t.created_by = o.user_id
  and t.title = o.title
  and t.completed
  and o.completed_at is not null;
