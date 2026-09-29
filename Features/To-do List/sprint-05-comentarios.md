# Sprint 5: Comentarios de texto

| | |
|---|---|
| **Estado** | ✅ Completado (2026-09-29) |
| **Duración estimada** | 1 semana |
| **Depende de** | Sprint 4 (panel de detalle) |
| **Maestro** | [00-documento-maestro.md](00-documento-maestro.md) |

## Objetivo

Añadir **comentarios de texto** a tareas y subtareas, en una **lista plana**. Se pueden escribir, editar y borrar los propios comentarios, pero **no se puede comentar un comentario**: no hay botón "Responder", ni hilos, ni anidación. Este sprint deja lista la estructura que el Sprint 6 amplía con imágenes y audios.

## Resultado demostrable

1. En el panel de "Llamar a proveedor", Ana escribe "Ya le dejé mensaje" y pulsa Enviar. El comentario aparece con su avatar, su nombre y "hace un momento".
2. Daniel (admin) abre la misma tarea y ve el comentario. Escribe otro y aparecen en orden cronológico.
3. Ana edita su comentario y se marca como "(editado)". No puede editar ni borrar el de Daniel.
4. Daniel borra el comentario de Ana porque es admin.
5. Una subtarea tiene su propio hilo de comentarios, independiente del de la tarea padre.
6. La tarjeta en el tablero muestra 💬 2.
7. Ningún comentario tiene opción de responder. Llamar a la API con un campo `parent_comment_id` falla porque la columna no existe.

## Historias de usuario

**H5.1: Como miembro, quiero comentar una tarea o subtarea para dejar contexto.**
- Composer al pie del panel: `Textarea` que crece hasta 8 líneas.
- Enter envía y Shift+Enter hace salto de línea. En móvil, solo el botón Enviar envía (Enter hace salto de línea).
- Máximo 5000 caracteres, con contador desde los 4500.
- El comentario aparece al instante (optimista, con opacidad reducida hasta confirmarse). Si falla, se marca "No enviado · Reintentar".

**H5.2: Como miembro, quiero leer la conversación de una tarea en orden.**
- Orden cronológico ascendente (lo más nuevo abajo, junto al composer). Al abrir el panel se hace scroll hasta el último comentario.
- Cada comentario muestra avatar, nombre, fecha relativa (con la fecha exacta en un tooltip), el cuerpo con saltos de línea respetados y los enlaces clicables (`target="_blank" rel="noopener noreferrer"`).
- **Sin markdown ni HTML.** El texto se renderiza como texto plano, lo que evita XSS.
- Si el autor fue eliminado, se muestra "Usuario eliminado" con un avatar genérico.
- Paginación: los últimos 50 comentarios, con "Ver comentarios anteriores" si hay más.

**H5.3: Como autor, quiero corregir o borrar lo que escribí.**
- Menú ⋯ en los comentarios propios: Editar (en línea; Esc cancela) y Eliminar (con confirmación).
- Al editar se fija `edited_at` y se muestra "(editado)".
- Un admin ve Eliminar en todos los comentarios, pero Editar solo en los suyos.

**H5.4: Como miembro, quiero saber qué tareas tienen conversación.**
- `TaskCard` y `TaskRow` muestran 💬 N cuando N > 0. El conteo incluye solo los comentarios de esa tarea, no los de sus subtareas.

## Trabajo técnico

### Base de datos (migración `…_task_comments.sql`)
- [ ] Tabla `task_comments` según el maestro (§6). **Sin `parent_comment_id`.** Añadir un comentario SQL que explique que es a propósito.
- [ ] `board_id` desnormalizado, rellenado por un trigger `before insert` desde `tasks.board_id`. El cliente nunca lo envía, así no se puede falsificar.
- [ ] `author_id` con `default auth.uid()` y `on delete set null`.
- [ ] Trigger `before update`:
  - solo se pueden cambiar `body` y `edited_at` (`edited_at := now()` automáticamente);
  - `author_id`, `task_id` y `board_id` son inmutables.
- [ ] Índice `(task_id, created_at)`.
- [ ] RLS:
  - select: `can_access_board(board_id)`.
  - insert: `can_access_board(board_id) and author_id = auth.uid()`.
  - update: `author_id = auth.uid()`.
  - delete: `author_id = auth.uid() or is_admin()`.
- [ ] RPC `create_comment(p_task_id uuid, p_body text, p_attachments jsonb default '[]')`. En este sprint solo usa `p_body` y valida que no esté vacío; el Sprint 6 activa `p_attachments`. Crearla ahora evita cambiar el contrato del cliente después.
- [ ] Conteos: vista `task_comment_counts (task_id, count)`, o añadirlos a la consulta de `useBoard` con un `select` agregado.

### Frontend
- [ ] Hooks:
  - `useComments(taskId)`: `useInfiniteQuery`, páginas de 50 por `created_at` descendente, invertidas al mostrar.
  - `useCreateComment`, `useUpdateComment` y `useDeleteComment`.
- [ ] Componentes `CommentList`, `CommentItem` (sin ninguna prop ni slot de "respuestas") y `CommentComposer`.
- [ ] Utilidad `linkify(text)`: devuelve nodos de React (texto y `<a>`); nunca usa `dangerouslySetInnerHTML`.
- [ ] Fechas relativas con `date-fns/formatDistanceToNow` en locale `es`.

## Pruebas
- [ ] Unitarias de `linkify`:
  - URLs con y sin protocolo;
  - puntuación final;
  - `<script>` como texto literal;
  - `javascript:` **no** se convierte en enlace.
- [ ] Script RLS con admin, Ana y un usuario ajeno:
  - el ajeno no lee ni crea comentarios;
  - Ana no edita el comentario de Daniel;
  - Daniel borra el de Ana;
  - insertar con `author_id` de otra persona falla;
  - cambiar `task_id` en un update falla.
- [ ] Test de componente: `CommentItem` no renderiza ningún control de "Responder".

## Fuera de este sprint
- Imágenes y audios (Sprint 6).
- Ver comentarios nuevos de otra persona sin recargar (Sprint 7).
- Menciones con @ y notificaciones de comentarios (futuro).

## Checklist de cierre
- [ ] Definición de "hecho" del maestro cumplida.
- [ ] Demo de los 7 pasos.
- [ ] Revisado explícitamente: no existe ningún camino (UI, API ni esquema) para comentar un comentario.

## Cierre

8 e2e (incluida paginación de más de 50), 10 verificaciones de RLS, test de componente sin "Responder". Los comentarios se crean sólo vía `create_comment`. **Desviación:** al abrir el panel no se hace scroll al último comentario (taparía la descripción); se hace al enviar.
