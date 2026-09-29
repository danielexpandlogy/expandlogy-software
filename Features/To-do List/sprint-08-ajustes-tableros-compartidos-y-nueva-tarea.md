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

**Tableros personales y de equipo** (migración `20260930100000_shared_boards.sql`):
- `boards.kind`: `personal` o `team`. Se quitó la regla "un tablero activo por usuario".
- RPC `create_board(name, kind, member_ids)`:
  - personal: cualquiera, y sólo lo ve quien lo crea;
  - team: sólo admins; quien lo crea también queda como miembro.
- RPC `set_board_members(board_id, member_ids)`: sólo admins y sólo tableros de equipo. Un equipo no puede quedar vacío.
- El dueño de un tablero personal puede renombrarlo y archivarlo. En uno de equipo, sólo un admin.
- `board_summaries` añade `kind`, `is_member` y `member_count`, y usa `left join` a `profiles`: con tableros compartidos, un usuario no puede leer el perfil del admin que creó el tablero, y el join interno le ocultaba el tablero entero.
- `create_board_for_user` se conserva por compatibilidad con la versión desplegada; ahora crea un tablero de equipo.

**Interfaz:**
- **Menú lateral:** bajo To-do List aparecen los tableros de la persona (personales y de equipo asignados).
- **Índice:** "Mis tableros" y, para admins, "Otros tableros del equipo".
- **Tablero de equipo:** "Personas del tablero" para asignar o quitar personas.
- **Home:** suma las tareas de todos los tableros de la persona.

## Pruebas

- **RLS:** 7 verificaciones nuevas (54 en total):
  - varios tableros personales, sin compartirlos;
  - un usuario no crea equipos ni asigna personas;
  - todos los miembros de un equipo lo ven;
  - quien es quitado pierde el acceso;
  - un miembro no renombra un equipo.
- **e2e:** el Sprint 1 se reescribió con el modelo nuevo y hay 3 pruebas nuevas del formulario (63 en total).
