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

**Formulario de nueva tarea** (iteración 3):
- Las tareas se crean **sólo desde su sección** ("Añadir tarea" de cada columna o grupo). No hay botón "Nueva tarea" arriba ni selector de sección.
- Campos: título, descripción, prioridad, fecha límite y recordatorio (Beta). **Sin subtareas:** se agregan en el detalle, una vez creada la tarea, igual que comentarios y adjuntos.
- **Un solo botón, "Crear tarea".** Se probó "Crear y abrir" y luego una casilla "Abrir al crearla"; ambas confundían y se quitaron.
- El "Añadir tarea rápida" del Home sigue siendo sólo título, con selector de tablero.

**Prioridad con banderas de color:** 🔴 Alta, 🟠 Media y 🔵 Baja, en tarjetas, filas, selectores y el Home. Los colores superan 3:1 sobre blanco (mínimo para iconos); la etiqueta va en gris.

**Menú "⋯" del tablero, arriba a la derecha:** reúne vista (Kanban / Lista), "Mostrar completadas" y, para quien puede gestionarlo, renombrar, personas y archivar. Reemplaza el toggle con texto y el interruptor sueltos. En móvil, la búsqueda baja a su propia fila.

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

## Revisión de UI (escritorio 1440 px y móvil 390 px)

Nuevo test `e2e/sprint-08-revision-ui.spec.ts`. Recorre 13 pantallas (14 en móvil) y falla si:
- algo se sale de la pantalla;
- hay scroll horizontal;
- se ensancha la ventana de layout en móvil;
- una tabla no cabe;
- hay errores de consola.

Encontró y quedaron corregidos:

1. **Móvil, crítico:** abrir el menú "⋯" en kanban colapsaba la página a ~30 px. Unos textos `sr-only` (posición absoluta) escapaban del contenedor con scroll horizontal y ensanchaban la ventana de layout a 1013 px; Radix compensaba ese "hueco" con 623 px de margen. Arreglo: `relative` en el contenedor del kanban.
2. Diálogos que se salían por la derecha con emails largos: `grid-cols-[minmax(0,1fr)]` en `Dialog` y `AlertDialog`.
3. En el formulario, el botón de recordatorio se salía del diálogo (3 columnas eran muy estrechas).
4. "Usuarios y roles" en móvil: la columna Rol quedaba cortada; el rol pasa bajo el nombre.
5. Home en móvil: la tarea rápida quedaba muy estrecha junto al selector de tablero.
6. El composer fijo de comentarios tapaba el último comentario al desplazarse hacia él.
7. Al abrir "Personas del tablero", el foco caía en "Cancelar" mientras cargaban las personas.

## Pruebas

- **RLS:** 9 verificaciones del modelo nuevo (55 en total):
  - varios tableros por persona;
  - un usuario no mete a otras personas;
  - un admin crea un tablero solo y luego añade personas;
  - quien es quitado pierde el acceso;
  - el creador no se puede quitar.
- **e2e:** el Sprint 1 se reescribió con el modelo nuevo (8 pruebas), 4 pruebas del formulario de tarea y la revisión de UI en escritorio y móvil (67 en total).
