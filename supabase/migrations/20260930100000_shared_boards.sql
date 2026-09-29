-- ─────────────────────────────────────────────────────────────────────────────
-- To-do List · Ajustes (Sprint 8): tableros personales y de equipo.
--
-- - Cualquier usuario crea tableros PERSONALES (sólo él es miembro).
-- - Un admin crea tableros DE EQUIPO y asigna a varias personas (admins o usuarios).
-- - Ya no existe "un tablero activo por usuario".
-- Compatibilidad: create_board_for_user se conserva (la usa la versión anterior
-- del frontend) y ahora crea un tablero de equipo con esa persona.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.boards
  add column kind text not null default 'personal' check (kind in ('personal', 'team'));

-- Los existentes: personales si el dueño lo creó para sí; si lo creó otra
-- persona (un admin "añadiendo al usuario"), de equipo.
update public.boards set kind = case when created_by is null or created_by = owner_id then 'personal' else 'team' end;

drop index if exists public.boards_one_active_per_owner;
create index boards_owner_idx on public.boards (owner_id);

-- Secciones iniciales, compartidas por ambas RPC.
create or replace function public.seed_board_sections(p_board_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.sections (board_id, name, position)
  values (p_board_id, 'Por hacer', public.order_key(0)),
         (p_board_id, 'En progreso', public.order_key(1)),
         (p_board_id, 'Listo', public.order_key(2));
$$;

revoke execute on function public.seed_board_sections(uuid) from public, anon, authenticated;

-- Crear un tablero. Personal: cualquiera, sólo con quien lo crea. De equipo:
-- sólo admins, con los miembros indicados (quien lo crea también queda como
-- miembro, para verlo en su menú).
create or replace function public.create_board(p_name text, p_kind text default 'personal', p_member_ids uuid[] default '{}')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board_id uuid;
  v_name text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if v_name = '' or char_length(v_name) > 120 then
    raise exception 'El nombre del tablero debe tener entre 1 y 120 caracteres';
  end if;
  if p_kind not in ('personal', 'team') then
    raise exception 'Tipo de tablero inválido';
  end if;
  if p_kind = 'team' and not public.is_admin() then
    raise exception 'Sólo un administrador puede crear tableros de equipo';
  end if;
  if p_kind = 'team' and exists (
    select 1 from unnest(coalesce(p_member_ids, '{}')) as m(id)
    where not exists (select 1 from public.profiles p where p.id = m.id)
  ) then
    raise exception 'Algún miembro no existe';
  end if;

  insert into public.boards (name, owner_id, created_by, kind)
  values (v_name, auth.uid(), auth.uid(), p_kind)
  returning id into v_board_id;

  insert into public.board_members (board_id, user_id, added_by)
  select v_board_id, m.id, auth.uid()
  from (
    select auth.uid() as id
    union
    select unnest(coalesce(p_member_ids, '{}')) where p_kind = 'team'
  ) m;

  perform public.seed_board_sections(v_board_id);
  return v_board_id;
end;
$$;

revoke execute on function public.create_board(text, text, uuid[]) from public, anon;
grant execute on function public.create_board(text, text, uuid[]) to authenticated;

-- Reemplaza los miembros de un tablero de equipo (sólo admins). Los
-- personales no se comparten.
create or replace function public.set_board_members(p_board_id uuid, p_member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  if not public.is_admin() then
    raise exception 'Sólo un administrador puede asignar personas a un tablero';
  end if;
  select kind into v_kind from public.boards where id = p_board_id;
  if v_kind is null then
    raise exception 'El tablero no existe';
  end if;
  if v_kind <> 'team' then
    raise exception 'Los tableros personales no se comparten';
  end if;
  if coalesce(array_length(p_member_ids, 1), 0) = 0 then
    raise exception 'Un tablero de equipo necesita al menos una persona';
  end if;
  if exists (
    select 1 from unnest(p_member_ids) as m(id)
    where not exists (select 1 from public.profiles p where p.id = m.id)
  ) then
    raise exception 'Algún miembro no existe';
  end if;

  delete from public.board_members where board_id = p_board_id and user_id <> all (p_member_ids);
  insert into public.board_members (board_id, user_id, added_by)
  select p_board_id, m.id, auth.uid() from unnest(p_member_ids) as m(id)
  on conflict (board_id, user_id) do nothing;
end;
$$;

revoke execute on function public.set_board_members(uuid, uuid[]) from public, anon;
grant execute on function public.set_board_members(uuid, uuid[]) to authenticated;

-- Compatibilidad con el frontend anterior: ahora crea un tablero de equipo.
create or replace function public.create_board_for_user(p_user_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Sólo un administrador puede añadir usuarios al To-do List';
  end if;
  return public.create_board(p_name, 'team', array[p_user_id]);
end;
$$;

-- Renombrar/archivar: un admin cualquier tablero; el dueño, su tablero personal.
drop policy "boards: sólo admin edita" on public.boards;
create policy "boards: admin o dueño de uno personal edita" on public.boards
  for update to authenticated
  using (public.is_admin() or (owner_id = auth.uid() and kind = 'personal'))
  with check (public.is_admin() or (owner_id = auth.uid() and kind = 'personal'));

-- Resumen: con tableros compartidos un usuario no puede leer el perfil de quien
-- lo creó (RLS de profiles) y el join interno le ocultaba el tablero entero.
drop view public.board_summaries;
create view public.board_summaries
with (security_invoker = true) as
select
  b.id,
  b.name,
  b.kind,
  b.owner_id,
  b.archived_at,
  b.created_at,
  coalesce(p.full_name, '') as owner_name,
  coalesce(p.email, '') as owner_email,
  exists (select 1 from public.board_members m where m.board_id = b.id and m.user_id = auth.uid()) as is_member,
  (select count(*) from public.board_members m where m.board_id = b.id) as member_count,
  count(t.id) filter (where not t.completed) as pending_count,
  count(t.id) filter (where t.completed) as completed_count
from public.boards b
left join public.profiles p on p.id = b.owner_id
left join public.tasks t on t.board_id = b.id and t.parent_id is null
group by b.id, p.id;

revoke all on public.board_summaries from anon;
grant select on public.board_summaries to authenticated;
