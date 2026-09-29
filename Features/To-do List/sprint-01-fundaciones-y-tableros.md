# Sprint 1: Fundaciones y tableros

| | |
|---|---|
| **Estado** | ✅ Completado (2026-09-29) |
| **Duración estimada** | 1 semana |
| **Depende de** | — |
| **Maestro** | [00-documento-maestro.md](00-documento-maestro.md) |

## Objetivo

Dejar el modelo de datos completo de tableros, secciones y tareas, con sus permisos, y el flujo en el que un admin **añade un usuario al To-do List y le crea su tablero**. Al terminar, nada de lo que ya funciona se rompe: las tareas actuales se migran y el Home sigue mostrando sus números.

## Resultado demostrable

1. Daniel (admin) entra a `/todos`, pulsa **Añadir usuario**, elige a "Ana" de la lista de usuarios registrados y confirma.
2. Aparece la tarjeta "Tablero de Ana" en el índice de tableros.
3. Ana inicia sesión, entra a `/todos` y la app la lleva directo a su tablero. Ve las secciones "Por hacer", "En progreso" y "Listo". Todavía no hay kanban interactivo; eso llega en el Sprint 2.
4. Un tercer usuario sin tablero ve el estado vacío "Aún no tienes un tablero. Pídele a un administrador que te añada."
5. El Home de Daniel muestra los mismos KPIs que antes de la migración.

## Historias de usuario

**H1.1: Como admin, quiero añadir un usuario registrado al To-do List para que tenga su propio tablero.**
- El diálogo lista solo los usuarios que aún no tienen tablero, con buscador por nombre y email.
- El nombre del tablero se propone como "Tablero de {nombre}" y se puede editar.
- Al confirmar se crean, en una sola transacción, el tablero, la membresía del dueño y las 3 secciones iniciales.
- Si el usuario ya tenía tablero (por ejemplo, por una carrera entre dos admins), se muestra el error "Este usuario ya tiene un tablero" y no se crea un duplicado.

**H1.2: Como admin, quiero ver los tableros de todos los usuarios para revisar su trabajo.**
- `/todos` muestra una cuadrícula de tableros con el avatar del dueño, el nombre y el conteo de tareas pendientes y completadas.
- Se puede buscar por nombre de usuario.

**H1.3: Como usuario, quiero entrar directo a mi tablero.**
- Si el usuario tiene exactamente un tablero, `/todos` redirige a `/todos/:boardId`.
- Si no tiene ninguno, ve el estado vacío descrito arriba.

**H1.4: Como admin, quiero renombrar o archivar un tablero.**
- Archivar oculta el tablero (`archived_at`); no borra nada.
- Un tablero archivado no aparece en el índice y su URL muestra el aviso "Este tablero está archivado".

**H1.5: Como usuario con tareas en la versión anterior, no quiero perderlas.**
- Cada `todos.user_id` con tareas recibe un tablero "Mis tareas" con sección "Por hacer", más "En progreso" y "Listo".
- Cada fila de `todos` pasa a `tasks`, conservando título, notas (como descripción), prioridad, fecha límite, completada y `completed_at`.

## Trabajo técnico

### Base de datos (migración `…_todo_boards.sql`)
- [ ] Tablas `boards`, `board_members`, `sections` y `tasks`, según el modelo del maestro (§6). Las columnas `position` van con `collate "C"`.
- [ ] Índices:
  - `sections (board_id, position)`
  - `tasks (section_id, position) where parent_id is null`
  - `tasks (parent_id, position)`
  - `tasks (board_id)`
- [ ] `can_access_board(uuid)`: `security definer`, `stable`, `search_path = ''`. Devuelve true si el usuario es admin (`is_admin()`) o miembro del tablero.
- [ ] Trigger `tasks_guard_parent`:
  - Si `parent_id` no es nulo, el padre debe tener `parent_id` nulo y el mismo `board_id`.
  - Si es una subtarea, `section_id` debe ser nulo.
  - `completed_at` se gestiona igual que el `set_todo_completed_at` actual; se reutiliza la función.
- [ ] Trigger `updated_at` en `boards` y `tasks`.
- [ ] RPC `create_board_for_user(p_user_id uuid, p_name text) returns uuid`:
  - Solo admin; si no, lanza una excepción.
  - Es `security definer` y valida que el usuario no tenga ya un tablero activo.
  - Usa un índice único parcial `boards (owner_id) where archived_at is null` como garantía.
- [ ] Políticas RLS:
  - `boards`: select con `can_access_board(id)`; update solo admin; sin insert ni delete directos (van por la RPC y el archivado).
  - `board_members`: select con `can_access_board(board_id)`; escritura solo admin.
  - `sections` y `tasks`: select, insert, update y delete con `can_access_board(board_id)`.
  - `revoke all … from anon` en las cuatro tablas.
- [ ] Datos iniciales de `position`: `a0`, `a1`, `a2` para las secciones iniciales (formato de `fractional-indexing`).
- [ ] Migración de datos `todos` → `tasks` en el mismo archivo, idempotente. **No se borra `todos`** hasta el Sprint 7.

### Frontend
- [ ] Crear `src/features/todo/` con la estructura del maestro (§8).
- [ ] Tipos en `src/lib/database.types.ts`: `Board`, `BoardMember`, `Section`, `Task`, más el tipo de la RPC.
- [ ] Hooks:
  - `useBoards()`: índice de tableros con conteos; una vista SQL `board_summaries` evita N+1.
  - `useBoard(boardId)`: tablero, secciones y tareas en una sola carga.
  - `useCreateBoardForUser()`.
  - `useArchiveBoard()` y `useRenameBoard()`.
- [ ] Páginas:
  - `BoardsIndex` (`/todos`): cuadrícula para el admin, redirección o estado vacío para el usuario.
  - `BoardPage` (`/todos/:boardId`): por ahora solo el encabezado y las secciones como columnas estáticas con sus tareas.
- [ ] Diálogo `AddUserToTodoDialog`, con un Command/Combobox de shadcn sobre `profiles`.
- [ ] Sidebar: "To-do List" sigue apuntando a `/todos`. Si el admin tiene más de un tablero visible, se añaden subítems colapsables con los tableros.
- [ ] Home: `todo-stats.ts` y el dashboard pasan a leer `tasks`, solo las de nivel superior. Para el admin, los KPIs son **sus** tareas, no las de todos.
- [ ] La página `/todos` vieja y `use-todos.ts` dejan de usarse, pero no se borran hasta el Sprint 7.

## Pruebas
- [ ] Unitarias: el `todo-stats` adaptado, con los casos actuales migrados a `Task`.
- [ ] Script de verificación RLS (`scripts/verify-rls/sprint-01.sh`, estilo curl, como el usado al montar auth), con admin, Ana y un usuario ajeno:
  - El ajeno no ve el tablero de Ana (lista vacía; un `GET` directo por id devuelve 0 filas).
  - Ana no puede llamar `create_board_for_user`.
  - Ana no puede crear una subtarea de una subtarea (el trigger lo rechaza).
  - Crear dos tableros activos para el mismo usuario falla.
- [ ] Migración de datos: contar filas de `todos` y de `tasks` antes y después, y que coincidan.

## Fuera de este sprint
- Drag and drop, crear tareas desde el tablero y el cambio de vista.
- Compartir un tablero con más miembros desde la UI (ver P2).

## Checklist de cierre
- [ ] Definición de "hecho" del maestro cumplida.
- [ ] Demo de los 5 pasos del "Resultado demostrable".
- [ ] Preguntas P1, P4 y P5 confirmadas o actualizadas en el maestro.

## Cierre

18 verificaciones de RLS, 6 e2e. Migración de `todos` → `tasks` idempotente (la tabla estaba vacía). Home adaptado a `tasks`. Carga de tareas paginada de 1000 en 1000 (límite de filas de la API).
