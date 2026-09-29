-- ─────────────────────────────────────────────────────────────────────────────
-- To-do List · Sprint 6: imágenes y audios en comentarios.
-- Archivos en un bucket PRIVADO; ruta {board_id}/{task_id}/{uuid}.{ext}.
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-attachments', 'task-attachments', false, 26214400, -- 25 MB (las imágenes se limitan a 10 MB en el cliente)
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-wav']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Segmento N de la ruta como uuid, o null si no lo es (nunca lanza: se usa en políticas).
create or replace function public.path_uuid(p_name text, p_segment int)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := split_part(p_name, '/', p_segment);
begin
  if v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return v::uuid;
  end if;
  return null;
end;
$$;

grant execute on function public.path_uuid(text, int) to authenticated;

create policy "task-attachments: ver si tiene acceso al tablero"
  on storage.objects for select to authenticated
  using (bucket_id = 'task-attachments' and public.can_access_board(public.path_uuid(name, 1)));

-- Subir sólo a {tablero accesible}/{tarea de ese tablero}/{archivo}.
create policy "task-attachments: subir a una tarea del tablero"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'task-attachments'
    and public.can_access_board(public.path_uuid(name, 1))
    and array_length(string_to_array(name, '/'), 1) = 3
    and exists (
      select 1 from public.tasks t
      where t.id = public.path_uuid(name, 2) and t.board_id = public.path_uuid(name, 1)
    )
  );

create policy "task-attachments: borra quien subió o un admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'task-attachments'
    and public.can_access_board(public.path_uuid(name, 1))
    and (owner_id = auth.uid()::text or public.is_admin())
  );
-- Sin política de update: los archivos son inmutables.

-- ── Adjuntos ────────────────────────────────────────────────────────────────

create table public.comment_attachments (
  id            uuid primary key default gen_random_uuid(),
  comment_id    uuid not null references public.task_comments (id) on delete cascade,
  board_id      uuid not null references public.boards (id) on delete cascade,
  kind          text not null check (kind in ('image', 'audio')),
  storage_path  text not null unique,
  mime_type     text not null,
  size_bytes    bigint not null,
  width         int,
  height        int,
  duration_ms   int,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);

create index comment_attachments_comment_idx on public.comment_attachments (comment_id);

alter table public.comment_attachments enable row level security;

create policy "comment_attachments: ver" on public.comment_attachments
  for select to authenticated using (public.can_access_board(board_id));
-- Sin insert/update/delete: se crean con create_comment y se borran en cascada.

revoke all on public.comment_attachments from anon;

-- ── create_comment v2: texto y/o adjuntos, en una transacción ───────────────

create or replace function public.create_comment(p_task_id uuid, p_body text, p_attachments jsonb default '[]'::jsonb)
returns public.task_comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board_id uuid;
  v_body text := coalesce(trim(p_body), '');
  v_items jsonb := coalesce(p_attachments, '[]'::jsonb);
  v_prefix text;
  v_comment public.task_comments;
  a record;
  o record;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  select board_id into v_board_id from public.tasks where id = p_task_id;
  if v_board_id is null or not public.can_access_board(v_board_id) then
    raise exception 'La tarea no existe o no tienes acceso';
  end if;
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'Adjuntos inválidos';
  end if;
  if jsonb_array_length(v_items) > 10 then
    raise exception 'Máximo 10 adjuntos por comentario';
  end if;
  if char_length(v_body) > 5000 then
    raise exception 'El comentario supera los 5000 caracteres';
  end if;
  if v_body = '' and jsonb_array_length(v_items) = 0 then
    raise exception 'El comentario está vacío';
  end if;

  v_prefix := v_board_id::text || '/' || p_task_id::text || '/';

  -- Validar todo antes de insertar nada.
  for a in select * from jsonb_to_recordset(v_items) as x(storage_path text, kind text, width int, height int, duration_ms int)
  loop
    if a.storage_path is null or not starts_with(a.storage_path, v_prefix)
       or position('/' in substr(a.storage_path, char_length(v_prefix) + 1)) > 0 then
      raise exception 'Ruta de adjunto inválida';
    end if;
    select * into o from storage.objects
    where bucket_id = 'task-attachments' and name = a.storage_path;
    if not found or o.owner_id is distinct from auth.uid()::text then
      raise exception 'El archivo adjunto no existe o no lo subiste tú';
    end if;
    if a.kind is null or a.kind not in ('image', 'audio')
       or not starts_with(coalesce(o.metadata ->> 'mimetype', ''), a.kind || '/') then
      raise exception 'El tipo del adjunto no coincide con el archivo';
    end if;
    if exists (select 1 from public.comment_attachments where storage_path = a.storage_path) then
      raise exception 'Ese archivo ya está adjunto a otro comentario';
    end if;
  end loop;

  insert into public.task_comments (task_id, author_id, body)
  values (p_task_id, auth.uid(), v_body)
  returning * into v_comment;

  -- Tipo y tamaño se toman del servidor (metadata de Storage), no del cliente.
  insert into public.comment_attachments
    (comment_id, board_id, kind, storage_path, mime_type, size_bytes, width, height, duration_ms, created_by)
  select v_comment.id, v_board_id, x.kind, x.storage_path,
         o.metadata ->> 'mimetype', coalesce((o.metadata ->> 'size')::bigint, 0),
         x.width, x.height, x.duration_ms, auth.uid()
  from jsonb_to_recordset(v_items) as x(storage_path text, kind text, width int, height int, duration_ms int)
  join storage.objects o on o.bucket_id = 'task-attachments' and o.name = x.storage_path;

  return v_comment;
end;
$$;

-- ── Limpieza de huérfanos (la usa la Edge Function attachments-gc) ──────────

-- Archivos del bucket con más de 24 h sin fila en comment_attachments: subidas
-- que nunca llegaron a comentario, o de comentarios/tareas ya borrados.
create or replace function public.attachment_orphans(p_limit int default 100)
returns table (name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name from storage.objects o
  where o.bucket_id = 'task-attachments'
    and o.created_at < now() - interval '24 hours'
    and not exists (select 1 from public.comment_attachments a where a.storage_path = o.name)
  order by o.created_at
  limit p_limit;
$$;

revoke execute on function public.attachment_orphans(int) from public, anon, authenticated;
grant execute on function public.attachment_orphans(int) to service_role;
