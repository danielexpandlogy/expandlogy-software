-- GoTrue (auth.admin.createUser) inserta la fila de auth.users y guarda
-- app_metadata en un UPDATE posterior, así que handle_new_user no ve el rol en
-- el INSERT y el perfil nacía siempre como 'user'. Este trigger copia el rol
-- cuando app_metadata.role aparece o cambia.
--
-- profiles.role sigue siendo la fuente de verdad: app_metadata.role sólo lo
-- escribe el service role (Edge Function admin-users) al crear el usuario; los
-- cambios de rol posteriores desde la app van directo a profiles.
create or replace function public.handle_user_app_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_app_meta_data ->> 'role' in ('admin', 'user')
     and new.raw_app_meta_data ->> 'role' is distinct from old.raw_app_meta_data ->> 'role' then
    update public.profiles
    set role = (new.raw_app_meta_data ->> 'role')::public.app_role
    where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_app_role_changed
  after update of raw_app_meta_data on auth.users
  for each row execute function public.handle_user_app_role_change();

-- Repara los perfiles creados antes de este trigger.
update public.profiles p
set role = (u.raw_app_meta_data ->> 'role')::public.app_role
from auth.users u
where u.id = p.id
  and u.raw_app_meta_data ->> 'role' in ('admin', 'user')
  and p.role::text <> u.raw_app_meta_data ->> 'role';
