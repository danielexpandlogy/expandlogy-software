-- ─────────────────────────────────────────────────────────────────────────────
-- Perfiles con rol (admin / user) y To-do List por usuario.
-- Toda la app requiere sesión: ninguna tabla es legible por `anon`.
-- ─────────────────────────────────────────────────────────────────────────────

create type public.app_role as enum ('admin', 'user');
create type public.todo_priority as enum ('low', 'medium', 'high');

-- ── Perfiles ────────────────────────────────────────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  job_title   text not null default '',
  phone       text not null default '',
  role        public.app_role not null default 'user',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- security definer: se usa dentro de las políticas de `profiles`, y leer la
-- tabla con RLS desde su propia política provocaría recursión infinita.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Crea el perfil al crear el usuario en Auth. El rol NO se toma de
-- raw_user_meta_data (lo controla el cliente); sólo de raw_app_meta_data, que
-- únicamente puede escribir el service role (Edge Function admin-users).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'user')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un usuario puede editar su perfil, pero no su rol ni su email (el email vive
-- en auth.users). Sólo un admin cambia roles, y nunca el suyo propio: así
-- siempre queda al menos el admin que está operando.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and auth.role() <> 'service_role' then
    raise exception 'El email no se puede modificar desde el perfil';
  end if;

  if new.role is distinct from old.role and auth.role() <> 'service_role' then
    if not public.is_admin() then
      raise exception 'Sólo un administrador puede cambiar roles';
    end if;
    if old.id = auth.uid() then
      raise exception 'No puedes cambiar tu propio rol';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

alter table public.profiles enable row level security;

create policy "profiles: ver el propio o todos si es admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles: editar el propio o cualquiera si es admin"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Insert y delete sólo ocurren vía trigger / cascada desde auth.users.

-- ── To-do List ──────────────────────────────────────────────────────────────

create table public.todos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null check (char_length(trim(title)) between 1 and 200),
  notes         text not null default '',
  priority      public.todo_priority not null default 'medium',
  due_date      date,
  completed     boolean not null default false,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index todos_user_id_created_at_idx on public.todos (user_id, created_at desc);

create or replace function public.set_todo_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.completed and (tg_op = 'INSERT' or not old.completed) then
    new.completed_at := now();
  elsif not new.completed then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger todos_set_completed_at
  before insert or update of completed on public.todos
  for each row execute function public.set_todo_completed_at();

alter table public.todos enable row level security;

create policy "todos: ver las propias"
  on public.todos for select to authenticated
  using (user_id = auth.uid());

create policy "todos: crear las propias"
  on public.todos for insert to authenticated
  with check (user_id = auth.uid());

create policy "todos: editar las propias"
  on public.todos for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "todos: borrar las propias"
  on public.todos for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.profiles, public.todos from anon;
