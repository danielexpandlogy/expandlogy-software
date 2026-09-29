# Sprint 6: Adjuntos (imágenes y audios)

| | |
|---|---|
| **Estado** | ✅ Completado (2026-09-29) |
| **Duración estimada** | 1 semana |
| **Depende de** | Sprint 5 (comentarios y RPC `create_comment`) |
| **Maestro** | [00-documento-maestro.md](00-documento-maestro.md) |

## Objetivo

Permitir que un comentario lleve **imágenes** y **audios**, subidos desde el dispositivo o, en el caso del audio, **grabados en el navegador**. Los archivos son privados: solo los ve quien tiene acceso al tablero.

## Resultado demostrable

1. En el composer, Ana pulsa 📎, elige 2 fotos del teléfono y ve sus miniaturas antes de enviar. Quita una con ✕.
2. Pulsa 🎙️, graba 15 segundos, escucha la vista previa y la adjunta.
3. Envía el comentario con el texto "Fotos del pedido y nota de voz". Aparecen la miniatura y un reproductor de audio con la duración `0:15`.
4. Daniel abre la tarea: la imagen se amplía en un visor a pantalla completa y el audio se reproduce.
5. Un usuario sin acceso al tablero copia la URL de la imagen. Una hora después la URL deja de funcionar, y sin sesión válida nunca pudo generar una nueva.
6. Un comentario puede ser **solo** adjuntos, sin texto.
7. En producción (Vercel), el navegador pide permiso de micrófono y la grabación funciona.

## Historias de usuario

**H6.1: Como miembro, quiero adjuntar imágenes a un comentario.**
- Se aceptan JPEG, PNG, WebP y GIF de hasta 10 MB cada una, con un máximo de 10 adjuntos por comentario.
- Se pueden seleccionar con el botón 📎, arrastrando archivos sobre el composer o pegando con Ctrl/⌘+V desde el portapapeles.
- Antes de subir, la imagen se redimensiona en el cliente a un máximo de 2560 px en su lado mayor y se recomprime (JPEG o WebP, calidad 0.85). Los GIF no se tocan, para no perder la animación.
- Cada miniatura muestra una barra de progreso de subida. El botón Enviar espera a que terminen todas.
- Un archivo rechazado (tipo o tamaño) muestra el motivo y no bloquea al resto.

**H6.2: Como miembro, quiero adjuntar o grabar audios.**
- Se aceptan MP3, M4A/MP4, WebM, OGG y WAV de hasta 25 MB.
- Grabación con 🎙️:
  - pide permiso de micrófono;
  - muestra el tiempo y un indicador de nivel;
  - botones Detener y Descartar;
  - se detiene sola a los 10 minutos.
- Tras detener, se ofrece una vista previa con reproductor y las opciones "Adjuntar" o "Descartar".
- Si el permiso se deniega: "Activa el micrófono en la configuración del navegador para grabar." Subir un archivo de audio sigue disponible.
- El formato grabado es el que soporte el navegador (`MediaRecorder.isTypeSupported`): `audio/webm;codecs=opus` en Chrome y Firefox, `audio/mp4` en Safari.

**H6.3: Como miembro, quiero ver y escuchar los adjuntos.**
- Las imágenes se muestran en una cuadrícula de miniaturas dentro del comentario. Al pulsar se abre un visor con anterior/siguiente, Esc para cerrar y un botón Descargar.
- Los audios se reproducen con un reproductor compacto (play/pausa, barra de progreso y duración) basado en `<audio>` nativo.
- Mientras carga la URL firmada se muestra un skeleton del tamaño correcto: `width` y `height` están guardados, así que no hay saltos de layout.

**H6.4: Como autor o admin, al borrar un comentario se borran sus archivos.**
- Eliminar un comentario borra primero sus objetos de Storage y después la fila. Si queda algo colgado, el job de limpieza lo recoge.

## Trabajo técnico

### Storage (migración `…_task_attachments.sql`)
- [ ] Bucket privado:
  ```sql
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('task-attachments', 'task-attachments', false, 26214400,
    array['image/jpeg','image/png','image/webp','image/gif',
          'audio/mpeg','audio/mp4','audio/x-m4a','audio/webm','audio/ogg','audio/wav']);
  ```
- [ ] Función `board_id_from_path(name text) returns uuid`: devuelve `null` (sin lanzar excepción) si el primer segmento no es un uuid válido.
- [ ] Políticas sobre `storage.objects` con `bucket_id = 'task-attachments'`:
  - select: `can_access_board(board_id_from_path(name))`.
  - insert: igual a select, y además el segundo segmento debe ser una tarea de ese tablero.
  - delete: `can_access_board(...) and (owner_id = auth.uid()::text or is_admin())`.
  - Sin update: los archivos son inmutables.
- [ ] Tabla `comment_attachments` según el maestro (§6), con RLS de select por `can_access_board(board_id)`. Insert solo vía `create_comment`; no hay política de insert directa.
- [ ] Ampliar `create_comment` para que valide `p_attachments`:
  - como máximo 10;
  - cada `storage_path` empieza por `{board_id}/{task_id}/`;
  - el objeto existe en `storage.objects` y lo subió `auth.uid()`;
  - `kind` coincide con el `mime_type`.
  Después inserta todo en la misma transacción. Un comentario sin texto es válido si trae al menos un adjunto.

### Limpieza de huérfanos
- [ ] Edge Function `attachments-gc` (service role). Lista los objetos del bucket con más de 24 h que no tienen fila en `comment_attachments` y los borra en lotes de 100.
- [ ] Programarla a diario con `pg_cron` + `pg_net`, o con las cron jobs de Supabase si el plan lo permite. Documentar cuál se usó.

### Frontend
- [ ] `src/features/todo/lib/media.ts`:
  - `resizeImage(file)` (canvas u `OffscreenCanvas`), que devuelve `{ blob, width, height }`;
  - `probeAudioDuration(blob)`.
  - **Ojo:** los WebM de `MediaRecorder` en Chrome reportan `duration = Infinity`, así que para las grabaciones se usa el tiempo medido por el grabador.
- [ ] `useUploadAttachment` con `supabase.storage.from('task-attachments').upload(path, blob, { contentType, upsert: false })`. La ruta es `{board_id}/{task_id}/{crypto.randomUUID()}.{ext}`.
- [ ] `useSignedUrls(paths)`: una sola llamada a `createSignedUrls` por comentario visible. `staleTime` de 50 minutos, para que la URL se renueve antes de caducar (expira a los 60).
- [ ] Componentes:
  - `AttachmentPicker` (📎, drop y pegar);
  - `AttachmentChip` (miniatura o audio, con progreso y ✕);
  - `AudioRecorder`;
  - `ImageGrid`;
  - `ImageLightbox` (Dialog de shadcn);
  - `AudioPlayer`.
- [ ] `useDeleteComment`: primero `storage.remove(paths)`, después `delete` de la fila.
- [ ] Si el usuario cierra el panel con subidas en curso: `confirm("Hay archivos subiéndose. ¿Salir de todos modos?")`.

### Infraestructura
- [ ] `vercel.json`: cambiar `microphone=()` por `microphone=(self)` en `Permissions-Policy`. **Sin esto, la grabación falla en producción aunque funcione en local.**
- [ ] Revisar el límite de Storage del plan de Supabase (1 GB en el plan gratuito) y dejar anotado el consumo esperado.

## Pruebas
- [ ] Unitarias:
  - `resizeImage` no agranda imágenes pequeñas y respeta la proporción;
  - validación de tipo y tamaño;
  - construcción de la ruta de Storage.
- [ ] Script RLS/Storage:
  - el ajeno no puede `createSignedUrl` de un archivo de otro tablero;
  - no puede subir a `{board_ajeno}/…`;
  - `create_comment` rechaza un `storage_path` de otro tablero o subido por otra persona;
  - Ana no puede borrar el archivo de Daniel, pero Daniel (admin) sí puede borrar el de Ana.
- [ ] Manual en dispositivos:
  - grabar en Chrome de escritorio, Safari de macOS, Safari de iOS y Chrome de Android, y reproducir cada grabación en los otros navegadores;
  - subir una foto HEIC desde iPhone (iOS la convierte a JPEG en el selector; verificarlo).
- [ ] Deploy de preview en Vercel: grabación funcionando (cabecera de micrófono correcta).

## Fuera de este sprint
- Video, PDF y otros documentos.
- Transcripción de audios.
- Adjuntos directos en la tarea (fuera de un comentario). Si se piden, el mismo bucket y tabla sirven con `comment_id` nulo.

## Checklist de cierre
- [ ] Definición de "hecho" del maestro cumplida.
- [ ] Demo de los 7 pasos, el 7 sobre el deploy de preview.
- [ ] `attachments-gc` ejecutado al menos una vez manualmente, con su log revisado.

## Cierre

8 e2e (imagen grande redimensionada, audio, grabación real con micrófono falso de Chrome, micrófono denegado, tipos no admitidos, borrado en Storage), 11 verificaciones de RLS/Storage. `attachments-gc` probado de punta a punta (borra sólo huérfanos de más de 24 h) y programado a diario (03:17 UTC). Bugs corregidos: choque de nombres en `create_comment` v2 (rompía todos los comentarios; lo detectó la regresión) y dimensiones 0×0 en imágenes pequeñas.
