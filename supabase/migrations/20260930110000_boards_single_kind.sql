-- ─────────────────────────────────────────────────────────────────────────────
-- To-do List · Sprint 8 (ajuste 2): un solo tipo de tablero.
--
-- - Cualquier persona (también un admin) crea tableros y queda como miembro.
-- - Sólo un admin elige quién más entra: al crearlo (opcional) o después.
-- - El creador (owner) siempre sigue en su tablero.
-- Reemplaza la distinción personal/equipo de 20260930100000.
-- ─────────────────────────────────────────────────────────────────────────────

drop view public.board_summaries;
drop policy "boards: admin o dueño de uno personal edita" on public.boards;
drop function public.create_board(text, text, uuid[]);
alter table public.boards drop column kind;

-- Renombrar/archivar: quien lo creó o un admin.
create policy "boards: el dueño o un admin edita" on public.boards
  for update to authenticated
  using (public.is_admin() or owner_id = auth.uid())
  with check (public.is_admin() or owner_id = auth.uid());

create or replace function public.create_board(p_name text, p_member_ids uuid[] default '{}')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_others uuid[] := array(select distinct m from unnest(coalesce(p_member_ids, '{}')) m where m <> auth.uid());
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if v_name = '' or char_length(v_name) > 120 then
    raise exception 'El nombre del tablero debe tener entre 1 y 120 caracteres';
  end if;
  if array_length(v_others, 1) > 0 and not public.is_admin() then
    raise exception 'Sólo un administrador puede añadir personas a un tablero';
  end if;
  if exists (select 1 from unnest(v_others) m(id) where not exists (select 1 from public.profiles p where p.id = m.id)) then
    raise exception 'Algún miembro no existe';
  end if;

  insert into public.boards (name, owner_id, created_by)
  values (v_name, auth.uid(), auth.uid())
  returning id into v_board_id;

  insert into public.board_members (board_id, user_id, added_by)
  select v_board_id, m.id, auth.uid() from (select auth.uid() as id union select unnest(v_others)) m;

  perform public.seed_board_sections(v_board_id);
  return v_board_id;
end;
$$;

revoke execute on function public.create_board(text, uuid[]) from public, anon;
grant execute on function public.create_board(text, uuid[]) to authenticated;

-- Reemplaza las personas de un tablero (sólo admins). El creador se conserva siempre.
create or replace function public.set_board_members(p_board_id uuid, p_member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_ids uuid[];
begin
  if not public.is_admin() then
    raise exception 'Sólo un administrador puede añadir o quitar personas de un tablero';
  end if;
  select owner_id into v_owner from public.boards where id = p_board_id;
  if v_owner is null then
    raise exception 'El tablero no existe';
  end if;
  v_ids := array(select distinct m from unnest(coalesce(p_member_ids, '{}') || v_owner) m);
  if exists (select 1 from unnest(v_ids) m(id) where not exists (select 1 from public.profiles p where p.id = m.id)) then
    raise exception 'Algún miembro no existe';
  end if;

  delete from public.board_members where board_id = p_board_id and user_id <> all (v_ids);
  insert into public.board_members (board_id, user_id, added_by)
  select p_board_id, m.id, auth.uid() from unnest(v_ids) as m(id)
  on conflict (board_id, user_id) do nothing;
end;
$$;

-- Compatibilidad con el frontend anterior.
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
  return public.create_board(p_name, array[p_user_id]);
end;
$$;

create view public.board_summaries
with (security_invoker = true) as
select
  b.id,
  b.name,
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
