# Sprint 2: Vista kanban con drag and drop

| | |
|---|---|
| **Estado** | ✅ Completado (2026-09-29) |
| **Duración estimada** | 1 semana |
| **Depende de** | Sprint 1 |
| **Maestro** | [00-documento-maestro.md](00-documento-maestro.md) |

## Objetivo

Que el tablero sea un kanban de verdad: columnas por sección, tarjetas que se crean en línea y **drag and drop** de tarjetas (dentro de una columna y entre columnas) y de columnas completas. Debe funcionar con ratón, en pantallas táctiles y con teclado.

## Resultado demostrable

1. Ana abre su tablero y ve tres columnas con sus tarjetas.
2. Escribe "Llamar a proveedor" en "+ Añadir tarea" al pie de "Por hacer" y pulsa Enter. La tarjeta aparece al instante.
3. Arrastra la tarjeta a "En progreso". Al recargar la página, sigue ahí.
4. Arrastra la columna "Listo" para ponerla primera.
5. Con teclado: Tab hasta una tarjeta, Espacio para levantarla, flechas para moverla y Espacio para soltarla. El lector de pantalla anuncia "Tarea movida a En progreso, posición 2 de 4".
6. En un iPhone: mantener pulsada una tarjeta 200 ms la levanta; deslizar sin mantener hace scroll horizontal entre columnas.

## Historias de usuario

**H2.1: Como miembro, quiero mover tarjetas arrastrándolas para reflejar su avance.**
- Mientras se arrastra se ve un "fantasma" de la tarjeta y un hueco en el destino.
- Al soltar, la tarjeta queda en su nueva posición sin parpadeo (actualización optimista).
- Si el servidor rechaza el cambio, la tarjeta vuelve a su sitio y aparece el toast "No se pudo mover la tarea".

**H2.2: Como miembro, quiero crear tareas rápido en una columna.**
- "+ Añadir tarea" abre un input en línea. Enter crea la tarea y deja el input abierto para la siguiente; Esc lo cierra.
- La tarea nueva va al final de la columna.

**H2.3: Como miembro, quiero gestionar las secciones.**
- Hay "+ Añadir sección" al final del tablero.
- El menú de cada columna ofrece Renombrar (edición en línea) y Eliminar.
- Eliminar una sección con tareas pide confirmación: "Se eliminarán también sus N tareas".
- Las columnas se reordenan arrastrando su encabezado.

**H2.4: Como miembro, quiero ver lo esencial de cada tarea sin abrirla.**
- La tarjeta muestra:
  - checkbox de completar;
  - título (máximo 3 líneas);
  - chip de prioridad;
  - fecha límite (en rojo si está vencida).
- Los contadores de subtareas (`2/5`) y comentarios se reservan en el diseño, pero se alimentan en los Sprints 4 y 5.
- Las tareas completadas se ocultan; el encabezado del tablero tiene el interruptor "Mostrar completadas".

## Trabajo técnico

### Dependencias
- [ ] `npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities fractional-indexing`

### Lógica de orden (`src/features/todo/lib/ordering.ts`)
- [ ] `positionBetween(before?: string, after?: string): string`, un envoltorio de `generateKeyBetween`.
- [ ] `positionAtEnd(items)` y `positionForIndex(items, index)`: calculan la clave según los vecinos en el destino, **excluyendo el propio ítem que se mueve**.
- [ ] Tests unitarios:
  - mover arriba, abajo, al inicio y al final;
  - columna vacía;
  - 1000 inserciones consecutivas en el mismo hueco, sin colisiones y con claves que siguen ordenadas.

### Drag and drop (`src/features/todo/lib/dnd.ts` + componentes)
- [ ] Un solo `DndContext` por tablero con:
  - `PointerSensor` (activación a 5 px de distancia);
  - `TouchSensor` (delay 200 ms, tolerancia 5 px);
  - `KeyboardSensor` con `sortableKeyboardCoordinates`.
- [ ] `SortableContext` horizontal para las columnas y uno vertical por columna para las tarjetas. Los ids llevan prefijo (`section:…` y `task:…`) para distinguir qué se arrastra.
- [ ] `onDragOver` mueve la tarjeta entre columnas en el estado local para que se vea el hueco; `onDragEnd` calcula `position` y persiste.
- [ ] `DragOverlay` con la tarjeta renderizada en su versión "levantada": sombra y ligera rotación.
- [ ] `accessibility.announcements` y `screenReaderInstructions` en español.
- [ ] Auto-scroll horizontal del tablero al arrastrar cerca del borde (viene activado por defecto en dnd-kit; se verifica).

### Datos
- [ ] Mutación `useMoveTask({ taskId, sectionId, position })`: un solo `update` a `tasks`, con actualización optimista sobre la caché de `useBoard(boardId)` y rollback en `onError`.
- [ ] `useMoveSection`, `useCreateSection`, `useRenameSection`, `useDeleteSection` y `useCreateTask`.
- [ ] Borrar una sección elimina sus tareas por cascada (`tasks.section_id → sections on delete cascade`). Hay que confirmarlo en la migración del Sprint 1 o añadirlo aquí.

### UI
- [ ] `SectionColumn`: 288 px de ancho, encabezado con nombre, conteo y menú; lista con scroll vertical propio; pie con "+ Añadir tarea".
- [ ] `TaskCard`: `button` accesible (se abre en el Sprint 4; por ahora no hace nada al pulsarla) con el handle en toda la tarjeta.
- [ ] Contenedor del tablero con `overflow-x-auto`, `scroll-snap-type: x mandatory` en móvil y columnas con `scroll-snap-align: start`.
- [ ] Estados de carga (skeleton de 3 columnas) y de error.

## Pruebas
- [ ] Unitarias de `ordering.ts` (ver arriba).
- [ ] Test de componente: mover una tarjeta con `KeyboardSensor` simulado en Testing Library y comprobar que llama a `useMoveTask` con la sección y la posición esperadas.
- [ ] Manual en Chrome, Safari, Safari iOS y Chrome Android: arrastrar dentro de una columna, entre columnas, reordenar columnas y hacer scroll horizontal sin levantar tarjetas por accidente.
- [ ] Rendimiento: un tablero con 300 tareas se arrastra sin tirones. Si no, se memorizan `TaskCard` y se evita volver a renderizar las columnas no afectadas.

## Fuera de este sprint
- Vista lista (Sprint 3).
- Abrir el detalle de la tarea (Sprint 4).
- Ver en vivo los movimientos de otra persona (Sprint 7).

## Checklist de cierre
- [ ] Definición de "hecho" del maestro cumplida.
- [ ] Demo de los 6 pasos, incluido el iPhone real.
- [ ] Decisión sobre P3 (¿"Listo" completa la tarea?) confirmada antes de cerrar la tarjeta visualmente.

## Cierre

10 e2e: ratón, teclado, reordenar columnas, secciones, completadas y 2 táctiles emulados (deslizar hace scroll; mantener pulsado arrastra). Hallazgos corregidos: `PointerSensor` competía con el scroll táctil (→ `MouseSensor` + `TouchSensor`); las flechas del teclado no saltaban de columna (coordenadas propias).
