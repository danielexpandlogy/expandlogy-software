# Sprint 7: Tiempo real, pulido y lanzamiento

| | |
|---|---|
| **Estado** | ✅ Completado (2026-09-29) |
| **Duración estimada** | 1 semana |
| **Depende de** | Sprints 1–6 |
| **Maestro** | [00-documento-maestro.md](00-documento-maestro.md) |

## Objetivo

Cerrar el feature para producción:
- Los cambios de una persona aparecen **en vivo** para las demás que ven el mismo tablero.
- Pasada completa de calidad: accesibilidad, móvil, rendimiento y estados vacíos.
- Pruebas end-to-end automatizadas.
- **Retirar el código y la tabla de la To-do List anterior.**

## Resultado demostrable

1. Daniel y Ana abren el mismo tablero en dos navegadores. Ana mueve una tarjeta y, en menos de 2 segundos, se mueve en la pantalla de Daniel sin recargar.
2. Daniel comenta en una tarea que Ana tiene abierta, y el comentario aparece en el panel de Ana.
3. Si Ana pierde la conexión, ve el aviso "Sin conexión, reintentando…". Al volver, el tablero se resincroniza solo.
4. La suite de Playwright (`npm run test:e2e`) pasa en local y en CI.
5. La tabla `todos` y los archivos `src/pages/Todos.tsx`, `src/hooks/use-todos.ts` y `src/components/todos/*` ya no existen, y el Home sigue funcionando.
6. El feature está desplegado en producción con las migraciones aplicadas.

## Historias de usuario

**H7.1: Como miembro, quiero ver al instante lo que cambian los demás.**
- Las tareas, secciones y comentarios creados, editados, movidos o borrados por otra persona se reflejan sin recargar.
- Los cambios propios no "rebotan": la actualización optimista no se pisa con el eco de Realtime.
- Si alguien borra la tarea que tengo abierta, el panel se cierra con "Esta tarea fue eliminada".

**H7.2: Como usuario en móvil, quiero que todo el feature sea cómodo con una mano.**
- Kanban: columnas a un 85 % del ancho con scroll-snap. La barra de acciones del tablero es fija abajo.
- Panel de detalle a pantalla completa, con el composer de comentarios fijo sobre el teclado (`visualViewport`).
- Objetivos táctiles de al menos 44 px.

**H7.3: Como usuario nuevo, quiero entender qué hacer en cada estado vacío.**
- Tablero sin tareas, sección vacía, tarea sin comentarios, índice de admin sin tableros y usuario sin tablero: cada uno con texto y una acción clara.

**H7.4: Como miembro, quiero encontrar tareas en tableros grandes.** *(Opcional; se hace si queda tiempo.)*
- Búsqueda por título dentro del tablero y filtros por prioridad y "vencidas", portados de la página `/todos` actual.

## Trabajo técnico

### Tiempo real
- [ ] Añadir `sections`, `tasks` y `task_comments` a la publicación `supabase_realtime` (migración).
- [ ] Hook `useBoardRealtime(boardId)`: un canal por tablero, con `postgres_changes` filtrado por `board_id=eq.{id}` para las tres tablas. RLS se aplica a Realtime, así que un usuario ajeno no recibe nada; hay que verificarlo.
- [ ] Aplicar los eventos sobre la caché de React Query:
  - `INSERT`/`UPDATE`: reemplazar la fila si su `updated_at` es más reciente que la de la caché.
  - `DELETE`: quitarla.
  - Los comentarios usan `created_at`/`edited_at` como marca.
- [ ] Ecos propios: cada mutación optimista registra `id + updated_at` esperado, y el evento que coincide se ignora.
- [ ] Reconexión: al pasar a estado `SUBSCRIBED` después de un corte, `invalidateQueries(['board', id])` para resincronizar todo.
- [ ] Indicador de conexión en `BoardHeader` (solo visible cuando hay problema).

### Pruebas end-to-end
- [ ] Añadir `@playwright/test` como devDependency y el script `test:e2e`.
- [ ] Proyecto de Supabase **de pruebas** (no el de producción) con usuarios semilla: admin, miembro y ajeno. Credenciales en variables de CI, nunca en el repo.
- [ ] Escenarios:
  1. Sin sesión, `/todos/*` redirige a `/login`.
  2. El admin añade un usuario al To-do List y se crea su tablero.
  3. Crear una tarea, arrastrarla a otra columna y verificar tras recargar (ratón y teclado).
  4. Cambiar a vista lista, mover una fila y volver a kanban.
  5. Abrir el detalle, editar la descripción, poner un recordatorio (ver el badge Beta) y crear y completar subtareas.
  6. Comentar con texto e imagen (fixture), y verificar que no existe el control "Responder".
  7. Un usuario ajeno no puede abrir la URL de un tablero ajeno.
  8. Dos contextos de navegador: un cambio en uno aparece en el otro (Realtime).

### Pulido
- [ ] Auditoría con axe (`@axe-core/playwright`) en el índice, el kanban, la lista y el panel de detalle: 0 violaciones serias o críticas.
- [ ] Rendimiento con un tablero de 500 tareas y 2000 comentarios:
  - carga inicial por debajo de 1,5 s en 4G simulado;
  - arrastre a 60 fps en escritorio.
  - Si hace falta, virtualizar la vista lista (`@tanstack/react-virtual`).
- [ ] Code splitting: `@dnd-kit` y el panel de detalle se cargan en lazy chunks. Hoy `index` pesa 642 kB; no debe crecer.
- [ ] Revisar todos los textos: español neutro, sin términos técnicos para el usuario final.

### Retirada del código anterior
- [ ] Migración `…_drop_legacy_todos.sql`: `drop table public.todos` y la función `set_todo_completed_at` si ya no se usa. Mantener el enum `todo_priority`, que usa `tasks`.
- [ ] Borrar `src/pages/Todos.tsx`, `src/hooks/use-todos.ts`, `src/components/todos/` y los tipos `Todo` de `database.types.ts`.
- [ ] `todo-stats.ts` queda solo con la versión basada en `Task`.
- [ ] Buscar referencias huérfanas con `grep -r "todos\b\|useTodos\|TodoItem" src`.

### Lanzamiento
- [ ] Deploy de preview en Vercel contra un proyecto de Supabase de staging, con la suite e2e en verde.
- [ ] `supabase db push` en producción, en orden, y verificar con `supabase migration list`.
- [ ] Desplegar las Edge Functions (`attachments-gc`) y activar su programación.
- [ ] Smoke test en producción con la cuenta de Daniel: crear, mover, comentar con audio y borrar.
- [ ] Actualizar el maestro: estado "Lanzado", fecha y decisiones que cambiaron.

## Fuera de este sprint
- Notificaciones de recordatorios por email y push. Es el siguiente feature natural: `reminder_at` ya está guardado y el badge Beta se quita cuando exista.
- Presencia ("Daniel está viendo esta tarea") y cursores en vivo.

## Checklist de cierre
- [ ] Definición de "hecho" del maestro cumplida.
- [ ] Demo de los 6 pasos, sobre producción.
- [ ] Maestro actualizado y todas las preguntas abiertas cerradas.

## Cierre

Realtime (con RLS verificada: un ajeno no recibe eventos), búsqueda en el tablero (H7.4), axe sin violaciones serias/críticas, rendimiento medido, bundle principal 657 → 223 kB, tabla `todos` y código antiguo retirados. Bug crítico encontrado y corregido: no se podía eliminar a un usuario que hubiera comentado.
