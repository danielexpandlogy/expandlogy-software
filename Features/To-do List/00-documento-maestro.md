# To-do List: documento maestro

| | |
|---|---|
| **Feature** | To-do List: tableros tipo Todoist (kanban y lista) |
| **Dueño de producto** | Daniel Acero |
| **Estado** | ✅ Implementado (los 7 sprints), en producción en Supabase |
| **Última actualización** | 2026-09-29 |
| **Sprints** | 7 + 1 de ajustes ([sprint-08](sprint-08-ajustes-tableros-compartidos-y-nueva-tarea.md)) |

---

## 1. Objetivo

Convertir la To-do List actual (una lista plana de tareas por usuario) en un gestor de tareas estilo Todoist:

- **Tableros** que crea cualquier persona (queda dentro). Sólo un admin elige quién más entra, al crearlo o después. *Cambiado en el Sprint 8; antes: un tablero por usuario creado por un admin.*
- Dos vistas del mismo tablero, intercambiables con un clic:
  - **Kanban:** columnas = secciones, tarjetas con drag and drop.
  - **Lista:** filas agrupadas por sección, también reordenables.
- **Tarjetas de tarea** con título, descripción, recordatorio (solo UI, con badge **Beta**) y **subtareas**.
- **Comentarios** en tareas y subtareas: texto, imágenes y audios. **Sin respuestas a comentarios**: los comentarios forman una lista plana, nunca un árbol.

## 2. Punto de partida (lo que ya existe)

| Pieza | Dónde | Qué pasa con ella |
|---|---|---|
| Tabla `todos` (título, notas, prioridad, fecha límite, completada) | `supabase/migrations/20260928120000_auth_profiles_todos.sql` | Se migra a `tasks` en el Sprint 1 y se elimina en el Sprint 7 |
| Página `/todos` (lista con filtros) | `src/pages/Todos.tsx`, `src/components/todos/*`, `src/hooks/use-todos.ts` | Se reemplaza por los tableros |
| Dashboard del Home (KPIs, gráfica, próximas tareas) | `src/pages/Home.tsx`, `src/lib/todo-stats.ts` | Se adapta para leer de `tasks` en el Sprint 1 |
| Perfiles y roles (`admin` / `user`), función `is_admin()` | migraciones + `src/contexts/AuthContext.tsx` | Se reutiliza para los permisos |
| Edge Function `admin-users` | `supabase/functions/admin-users` | No cambia |
| Storage de Supabase | — | Se usa por primera vez en el Sprint 6 |
| `vercel.json` → `Permissions-Policy: microphone=()` | `vercel.json` | **Bloquea grabar audio en el navegador.** Hay que cambiarlo a `microphone=(self)` en el Sprint 6 |

## 3. Alcance

**Dentro:**
- Tableros, secciones, tareas y subtareas (un solo nivel).
- Vistas kanban y lista, con drag and drop en ambas y la última vista usada recordada.
- Alta de usuarios en el To-do List por parte de un admin, con creación de su tablero.
- Detalle de tarea: título, descripción, prioridad, fecha límite, recordatorio Beta y subtareas.
- Comentarios planos con texto, imágenes y audios (subidos o grabados en el navegador).
- Sincronización en tiempo real entre quienes ven el mismo tablero.

**Fuera (futuro):**
- Envío real de recordatorios por email o push. El campo se guarda, pero nada se envía.
- Respuestas a comentarios, hilos o reacciones. **Excluido a propósito, no pospuesto.**
- Asignar tareas a otra persona, etiquetas, filtros guardados, tareas recurrentes.
- Subtareas de subtareas (más de un nivel).
- Mover tareas entre tableros distintos.
- Adjuntos de video o documentos.

## 4. Glosario

| Término | Significado |
|---|---|
| **Tablero** (`boards`) | Espacio de trabajo de una persona. Equivale a un "proyecto" de Todoist |
| **Miembro** (`board_members`) | Usuario con acceso a un tablero. El dueño siempre es miembro |
| **Sección** (`sections`) | Columna en la vista kanban o grupo en la vista lista |
| **Tarea** (`tasks`, `parent_id` nulo) | Tarjeta del tablero. Vive en una sección |
| **Subtarea** (`tasks`, `parent_id` = tarea) | Hija de una tarea. No es tarjeta propia; se ve dentro del detalle y, en la vista lista, sangrada bajo su tarea |
| **Comentario** (`task_comments`) | Mensaje en una tarea o subtarea. Nunca tiene padre |
| **Adjunto** (`comment_attachments`) | Imagen o audio de un comentario, guardado en Storage |

## 5. Decisiones de diseño

Cada decisión incluye el porqué, para poder revisarla sin reabrir toda la discusión.

1. **Kanban y lista son dos vistas del mismo dato.** Las secciones son columnas en una vista y grupos en la otra; no hay dos modelos. Así funciona Todoist, y cambiar de vista no mueve ni duplica nada.
2. **Subtareas en la misma tabla `tasks`, con `parent_id`, limitadas a un nivel.** Comparten todos los campos y ambas aceptan comentarios, así que una sola tabla evita duplicar lógica. El límite de un nivel lo impone un trigger en la base de datos, no solo la UI.
3. **Comentarios sin `parent_comment_id`.** Como la columna no existe, no se puede comentar un comentario ni por API. La regla de "sin árbol" queda garantizada por el esquema.
4. **Orden con claves fraccionarias** (paquete `fractional-indexing`, columna `position text collate "C"`). Mover una tarjeta actualiza una sola fila, no todas las de la columna, y nunca hay que renumerar. La collation `"C"` hace que Postgres ordene igual que JavaScript.
5. **Drag and drop con `@dnd-kit`** (`core` + `sortable`). Es accesible con teclado, soporta táctil y tiene un solo motor para kanban y lista. `react-beautiful-dnd` está abandonado.
6. **Acceso = miembros del tablero + todos los admins.** El admin crea los tableros y necesita verlos; `board_members` deja lista la opción de compartir un tablero con más personas sin cambiar el esquema.
7. **El recordatorio se guarda (`reminder_at`) aunque no se envíe nada.** Si se descartara el valor, el usuario creería que lo configuró. Guardarlo deja los datos listos para cuando existan las notificaciones. La UI lo marca como **Beta**.
8. **Completar ≠ cambiar de sección.** Como en Todoist, completar es un checkbox independiente. Las tareas completadas se ocultan por defecto, con un interruptor "Mostrar completadas". Ver la pregunta abierta P3.
9. **Adjuntos en un bucket privado con URLs firmadas.** Las imágenes y los audios de un tablero solo los ve quien tiene acceso al tablero. Los permisos de Storage reutilizan la misma función `can_access_board()` que las tablas.
10. **Estado del servidor con React Query y actualizaciones optimistas.** Arrastrar una tarjeta tiene que sentirse instantáneo; si el servidor falla, la tarjeta vuelve a su sitio y se muestra un aviso. Es el patrón que ya usa `use-todos.ts`.

## 6. Modelo de datos

Resumen; el SQL exacto se escribe en cada sprint.

```text
boards
  id uuid PK
  name text                      -- "Tablero de Ana"
  owner_id uuid → profiles       -- on delete cascade
  created_by uuid → profiles     -- el admin que lo creó
  archived_at timestamptz null
  created_at, updated_at

board_members
  board_id uuid → boards         -- on delete cascade
  user_id uuid → profiles        -- on delete cascade
  added_by uuid → profiles
  created_at
  PK (board_id, user_id)

sections
  id uuid PK
  board_id uuid → boards         -- on delete cascade
  name text
  position text collate "C"
  created_at

tasks
  id uuid PK
  board_id uuid → boards         -- desnormalizado: RLS y Realtime filtran por él
  section_id uuid → sections     -- null solo en subtareas
  parent_id uuid → tasks null    -- on delete cascade; trigger: el padre no puede tener padre
  title text (1–500)
  description text default ''
  priority todo_priority default 'medium'   -- enum que ya existe
  due_date date null
  reminder_at timestamptz null   -- Beta: se guarda, no se envía
  completed boolean, completed_at timestamptz
  position text collate "C"
  created_by uuid → profiles
  created_at, updated_at

task_comments                    -- sin parent_comment_id, a propósito
  id uuid PK
  task_id uuid → tasks           -- on delete cascade; sirve para tareas y subtareas
  board_id uuid → boards         -- desnormalizado para RLS
  author_id uuid → profiles null -- on delete set null → "Usuario eliminado"
  body text default ''
  edited_at timestamptz null
  created_at
  check: body no vacío O el comentario tiene adjuntos (validado en la RPC create_comment)

comment_attachments
  id uuid PK
  comment_id uuid → task_comments  -- on delete cascade
  board_id uuid → boards
  kind text check in ('image','audio')
  storage_path text unique       -- {board_id}/{task_id}/{uuid}.{ext}
  mime_type text, size_bytes int
  width int null, height int null, duration_ms int null
  created_by uuid → profiles
  created_at
```

**Funciones SQL clave:**
- `can_access_board(board_id) → boolean`: `security definer`; devuelve true si el usuario es admin o miembro del tablero. Se usa en todas las políticas RLS y en las de Storage.
- `create_board_for_user(user_id, name) → board_id`: solo admins. En una transacción crea el tablero, al dueño como miembro y tres secciones iniciales.
- `create_comment(task_id, body, attachments jsonb) → comment`: inserta el comentario y sus adjuntos de forma atómica.

## 7. Permisos

| Acción | Admin | Miembro del tablero | Otro usuario |
|---|:-:|:-:|:-:|
| Ver la lista de todos los tableros | ✅ | solo los suyos | solo los suyos |
| Crear un tablero (queda dentro) | ✅ | ✅ | ✅ |
| Añadir o quitar personas de un tablero (el creador nunca se quita) | ✅ | ❌ | ❌ |
| Renombrar o archivar un tablero | ✅ | sólo si lo creó | ❌ |
| Crear, renombrar, reordenar y borrar secciones | ✅ | ✅ | ❌ |
| Crear, editar, mover, completar y borrar tareas y subtareas | ✅ | ✅ | ❌ |
| Comentar y adjuntar | ✅ | ✅ | ❌ |
| Editar un comentario | solo los propios | solo los propios | ❌ |
| Borrar un comentario | cualquiera | solo los propios | ❌ |
| Ver o descargar adjuntos | ✅ | ✅ | ❌ |

Todo se impone con RLS en Postgres y políticas de Storage. La UI solo oculta botones; nunca es la única barrera.

## 8. Arquitectura frontend

**Rutas:**

| Ruta | Qué muestra |
|---|---|
| `/todos` | Admin: tableros de todos los usuarios y el botón "Añadir usuario". Usuario: redirige a su tablero, o muestra un estado vacío si aún no tiene |
| `/todos/:boardId` | El tablero. La vista va en `?vista=kanban` o `?vista=lista`; la última usada se recuerda en `localStorage` |
| `/todos/:boardId/t/:taskId` | El tablero con el detalle de la tarea abierto. El enlace se puede compartir |

**Estructura propuesta:**

```text
src/features/todo/
  api/            hooks de React Query: useBoards, useBoard, useMoveTask, useComments…
  components/
    board/        BoardHeader, ViewToggle, SectionColumn, TaskCard (kanban)
    list/         SectionGroup, TaskRow (lista)
    task/         TaskDetailSheet, SubtaskList, ReminderPicker (Beta)
    comments/     CommentList, CommentComposer, AttachmentPreview, AudioRecorder
  lib/            ordering.ts (claves fraccionarias), dnd.ts (sensores, anuncios en español)
  pages/          BoardsIndex, BoardPage
```

La carpeta `src/features/todo/` agrupa todo el feature en un solo lugar. El `src/components/todos/` actual se elimina en el Sprint 7.

**Dependencias nuevas:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `fractional-indexing`.

## 9. Adjuntos (resumen técnico)

- Bucket **privado** `task-attachments`. Ruta de cada archivo: `{board_id}/{task_id}/{uuid}.{ext}`.
- Las políticas de Storage leen el `board_id` del primer segmento de la ruta y llaman a `can_access_board()`.
- **Imágenes:** JPEG, PNG, WebP y GIF, hasta 10 MB. Se redimensionan en el navegador a un máximo de 2560 px antes de subir (salvo los GIF).
- **Audios:** MP3, M4A/MP4, WebM, OGG y WAV, hasta 25 MB o 10 minutos. Se pueden subir o grabar en el navegador con `MediaRecorder`: Chrome graba WebM y Safari MP4.
- Como máximo 10 adjuntos por comentario.
- Se muestran con URLs firmadas de 1 hora, pedidas en lote.
- Un job de limpieza borra los archivos huérfanos: subidas que no llegaron a comentario, o tareas y comentarios borrados.

## 10. Plan de sprints

| # | Sprint | Resultado demostrable | Doc |
|---|---|---|---|
| 1 | Fundaciones y tableros | Un admin añade a un usuario al To-do List y aparece su tablero con 3 secciones. Las tareas viejas ya están migradas | [sprint-01](sprint-01-fundaciones-y-tableros.md) |
| 2 | Vista kanban con drag and drop | Crear secciones y tareas, y arrastrarlas entre columnas con ratón, táctil y teclado | [sprint-02](sprint-02-vista-kanban-drag-and-drop.md) |
| 3 | Vista lista y cambio de vista | El mismo tablero en filas por sección, reordenable, con un toggle que se recuerda | [sprint-03](sprint-03-vista-lista-y-cambio-de-vista.md) |
| 4 | Detalle de tarea, subtareas y recordatorio Beta | Abrir una tarjeta, editar todos sus campos, crear y completar subtareas, poner un recordatorio (Beta) | [sprint-04](sprint-04-detalle-de-tarea-y-subtareas.md) |
| 5 | Comentarios de texto | Comentar tareas y subtareas, y editar o borrar los propios. Imposible responder a un comentario | [sprint-05](sprint-05-comentarios.md) |
| 6 | Adjuntos: imágenes y audios | Adjuntar fotos y audios (o grabar uno) en un comentario y verlos o escucharlos | [sprint-06](sprint-06-adjuntos-imagenes-y-audio.md) |
| 7 | Tiempo real, pulido y lanzamiento | Dos personas ven los cambios del otro al instante; QA completo; se retira el código viejo | [sprint-07](sprint-07-tiempo-real-pulido-y-lanzamiento.md) |

Los sprints 3 y 4 dependen solo del 2, así que se pueden hacer en paralelo si hay dos personas. La única pieza del 4 que necesita el 3 es mostrar las subtareas en la vista lista. Los sprints 4 → 5 → 6 → 7 van en orden.

## 11. Definición de "hecho" (aplica a todos los sprints)

- [ ] Migraciones aplicadas en Supabase con `supabase db push`; nada se crea a mano en el Dashboard.
- [ ] RLS probada con al menos tres identidades: admin, miembro y usuario ajeno. Cada sprint deja su script de verificación.
- [ ] `npm run typecheck`, `npm run lint` y `npm test` en verde.
- [ ] Probado en escritorio y en móvil (390 px de ancho), en claro, con teclado.
- [ ] Sin errores en la consola del navegador.
- [ ] Textos de la UI en español.
- [ ] Este documento actualizado si alguna decisión cambió.

## 12. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Drag and drop en móvil choca con el scroll horizontal del kanban | Alto | `TouchSensor` con retardo de 200 ms; columnas con scroll-snap; se prueba en un iPhone real en el Sprint 2 |
| Dos personas mueven la misma tarjeta a la vez | Medio | Gana la última escritura; Realtime (Sprint 7) refresca al otro. Aceptable para tableros personales |
| Archivos huérfanos en Storage llenan el plan gratuito (1 GB) | Medio | Job de limpieza y límites de tamaño (Sprint 6); compresión de imágenes en el cliente |
| Permiso de micrófono bloqueado por `vercel.json` | Alto (la grabación no funcionaría en producción) | Cambiar la cabecera en el Sprint 6 y probar en el deploy de preview |
| Safari graba audio en MP4 y Chrome en WebM | Bajo | Guardar el `mime_type` real; ambos formatos se reproducen en los navegadores modernos |

## 13. Preguntas abiertas

Tienen una respuesta por defecto para no bloquear el trabajo; el dueño de producto puede cambiarlas.

| # | Pregunta | Por defecto |
|---|---|---|
| P1 | ¿Un usuario normal puede crearse tableros adicionales, o solo los crea un admin? | ~~Solo el admin~~ → **Decidido (Sprint 8): cualquiera crea tableros** |
| P2 | ¿Se puede compartir un tablero con más de una persona desde la UI? | ~~Sólo el dueño~~ → **Decidido (Sprint 8): sí, varias personas por tablero, y sólo un admin las añade o quita** |
| P3 | ¿Mover una tarjeta a la última sección ("Listo") la marca como completada? | No; completar es independiente |
| P4 | ¿Qué secciones trae un tablero nuevo? | "Por hacer", "En progreso", "Listo" |
| P5 | ¿El admin ve los tableros de todos o solo los que creó? | Los de todos |
| P6 | ¿Se conservan prioridad y fecha límite en las tarjetas? (No se pidieron, pero ya existen) | Sí |

## 14. Resultado de la implementación (2026-09-29)

**Preguntas abiertas:** se aplicaron las respuestas por defecto de la tabla anterior (P1–P6).

*Actualizado tras el Sprint 8: RLS 55/55, e2e 64/64 (+1 de rendimiento).*

**Cómo se verifica** (todo contra el proyecto real de Supabase, con identidades temporales que se crean y se borran en cada corrida):

| Qué | Comando | Resultado |
|---|---|---|
| Permisos (RLS, Storage, Realtime) | `npm run verify:rls` | 47/47 |
| Unitarios | `npm test` | 54/54 |
| End-to-end (Playwright) | `npm run test:e2e` | 59/59 (+1 de rendimiento aparte) |
| Accesibilidad (axe, WCAG 2.1 AA) | incluido en e2e | 0 violaciones serias o críticas |
| Rendimiento | `npm run build && npx vite preview --port 4173` y `PERF_BASE_URL=http://127.0.0.1:4173 npx playwright test e2e/sprint-07-rendimiento.spec.ts` | ver abajo |

**Desviaciones respecto del plan:**
- **No hay proyecto de staging ni CI.** Los e2e corren contra el proyecto de producción con usuarios temporales (`e2e-*@example.com`, `rls-*@example.com`) que se borran al terminar. Si alguno no se puede borrar, la corrida falla en voz alta.
- **Rendimiento con 500 tareas y 2000 comentarios:** la carga en frío en "Fast 4G" tarda ~1,7 s (meta: 1,5 s). Arrastrar con 400 tarjetas visibles produce 2 pausas de ~100 ms (al levantar y al cambiar de columna); con tableros de tamaño normal no se nota. Pendiente para eliminarlas: virtualizar las columnas.
- **Área táctil del checkbox:** 36 px en lugar de 44 px. Con 44 px tapaba el asa de arrastre vecina (lo detectó un test y quedó uno de regresión).
- **Comentarios:** al abrir el panel no se salta al último comentario (taparía la descripción); se hace al enviar uno.

**Bugs encontrados por las pruebas y corregidos:**
1. `create_comment` v2: una variable chocaba con un alias de tabla y rompía **todos** los comentarios (migración `20260929131000`).
2. Imágenes pequeñas se guardaban con dimensiones 0×0 (se leían tras cerrar el bitmap).
3. **No se podía eliminar a un usuario que hubiera comentado**: el trigger de inmutabilidad trataba el `on delete set null` del autor como una edición prohibida (migración `20260929142000`).
4. El "over" de dnd-kit oscilaba al cambiar de sección y soltaba la tarea un puesto corrida.
5. En móvil, el `PointerSensor` competía con el scroll horizontal del kanban.
6. Varias fallas de contraste (rojo, ámbar, gris) y controles anidados (checkbox dentro del botón de la tarjeta).

**Operación:**
- Limpieza de adjuntos huérfanos: Edge Function `attachments-gc`, programada con `pg_cron` a las 03:17 UTC. La URL y el secreto viven en Vault (`project_url`, `attachments_gc_secret`) y el secreto también en la función (`GC_SECRET`).
- Los recordatorios siguen en **Beta**: `tasks.reminder_at` se guarda, pero nada envía notificaciones. Es el siguiente feature natural.
