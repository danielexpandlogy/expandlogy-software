# Sprint 8: Ajustes — tableros compartidos y formulario de nueva tarea

| | |
|---|---|
| **Estado** | ✅ Completado (2026-09-29) |
| **Origen** | Feedback de Daniel tras usar la versión 1 |
| **Maestro** | [00-documento-maestro.md](00-documento-maestro.md) |

## Qué pidió el dueño de producto

1. "Añadir tarea" no debe pedir sólo el nombre, sino todo lo que incluye una tarea.
2. Un tablero no pertenece necesariamente a un usuario:
   - todos los usuarios pueden crear tableros personales;
   - un admin crea tableros y asigna a varias personas del equipo (admins o usuarios);
   - cada persona ve en el menú los tableros a los que la asignaron.

## Cambios

**Formulario de nueva tarea.** "Añadir tarea" (en cada columna o sección) y el botón "Nueva tarea" del encabezado abren un formulario con:
- título, descripción, sección, prioridad, fecha límite y recordatorio (Beta);
- subtareas: se escriben y se añaden con Enter.

"Crear y abrir" deja la tarea abierta para comentar y adjuntar, porque un comentario necesita que la tarea exista. El "Añadir tarea rápida" del Home sigue siendo sólo título y ahora permite elegir el tablero.

**Un solo tipo de tablero** (migraciones `20260930100000_shared_boards.sql` y `20260930110000_boards_single_kind.sql`).

*Iteración 2, a pedido del dueño de producto: no hay que elegir entre "personal" y "de equipo".*

- Cualquier persona, admin incluido, crea los tableros que quiera y queda dentro. Se quitó la regla "un tablero activo por usuario".
- **Sólo un admin** elige quién más entra: al crearlo (opcional, puede crearlo estando solo) o después, con "Personas del tablero". Puede hacerlo en cualquier tablero, también en uno creado por un usuario.
- Quien creó el tablero (`owner_id`) siempre sigue en él; no se le puede quitar.
- Renombrar o archivar: quien lo creó o un admin.
- RPC `create_board(name, member_ids)`: un usuario no puede pasar otras personas. `set_board_members(board_id, member_ids)`: sólo admins, y siempre conserva al creador.
- `board_summaries` añade `is_member` y `member_count`, y usa `left join` a `profiles`: un usuario no puede leer el perfil del admin que lo añadió, y el join interno le ocultaba el tablero entero.
- `create_board_for_user` se conserva por compatibilidad con la versión desplegada.

**Interfaz:**
- **Menú lateral:** bajo To-do List aparecen los tableros de la persona (los que creó y a los que la añadieron).
- **Índice:** "Mis tableros" y, para admins, "Otros tableros del equipo".
- **Personas del tablero** (sólo admins): añadir o quitar personas; el creador aparece fijo.
- **Home:** suma las tareas de todos los tableros de la persona.

## Pruebas

- **RLS:** 9 verificaciones del modelo nuevo (55 en total):
  - varios tableros por persona;
  - un usuario no mete a otras personas;
  - un admin crea un tablero solo y luego añade personas;
  - quien es quitado pierde el acceso;
  - el creador no se puede quitar.
- **e2e:** el Sprint 1 se reescribió con el modelo nuevo (8 pruebas) y hay 3 pruebas nuevas del formulario de tarea (64 en total).
