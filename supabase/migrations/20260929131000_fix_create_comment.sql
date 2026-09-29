-- Corrige create_comment v2 (20260929130000): la variable plpgsql `o` chocaba
-- con el alias `o` de storage.objects ("record o is not assigned yet" /
-- "column reference o.bucket_id is ambiguous") y rompía todos los comentarios.
-- Variable → v_obj, alias → so; sin adjuntos se sale antes del insert.
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
  v_obj record;
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
    select * into v_obj from storage.objects so
    where so.bucket_id = 'task-attachments' and so.name = a.storage_path;
    if not found or v_obj.owner_id is distinct from auth.uid()::text then
      raise exception 'El archivo adjunto no existe o no lo subiste tú';
    end if;
    if a.kind is null or a.kind not in ('image', 'audio')
       or not starts_with(coalesce(v_obj.metadata ->> 'mimetype', ''), a.kind || '/') then
      raise exception 'El tipo del adjunto no coincide con el archivo';
    end if;
    if exists (select 1 from public.comment_attachments where storage_path = a.storage_path) then
      raise exception 'Ese archivo ya está adjunto a otro comentario';
    end if;
  end loop;

  insert into public.task_comments (task_id, author_id, body)
  values (p_task_id, auth.uid(), v_body)
  returning * into v_comment;

  if jsonb_array_length(v_items) = 0 then
    return v_comment;
  end if;

  -- Tipo y tamaño se toman del servidor (metadata de Storage), no del cliente.
  insert into public.comment_attachments
    (comment_id, board_id, kind, storage_path, mime_type, size_bytes, width, height, duration_ms, created_by)
  select v_comment.id, v_board_id, x.kind, x.storage_path,
         so.metadata ->> 'mimetype', coalesce((so.metadata ->> 'size')::bigint, 0),
         x.width, x.height, x.duration_ms, auth.uid()
  from jsonb_to_recordset(v_items) as x(storage_path text, kind text, width int, height int, duration_ms int)
  join storage.objects so on so.bucket_id = 'task-attachments' and so.name = x.storage_path;

  return v_comment;
end;
$$;

