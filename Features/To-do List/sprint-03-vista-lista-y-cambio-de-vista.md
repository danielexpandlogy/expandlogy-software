# Sprint 3: Vista lista y cambio de vista

| | |
|---|---|
| **Estado** | ✅ Completado (2026-09-29) |
| **Duración estimada** | 1 semana |
| **Depende de** | Sprint 2 (reutiliza `ordering.ts`, las mutaciones y la configuración de dnd-kit) |
| **Maestro** | [00-documento-maestro.md](00-documento-maestro.md) |

## Objetivo

Ofrecer una segunda forma de ver el mismo tablero: **filas agrupadas por sección**, como la vista lista de Todoist. Se cambia entre kanban y lista con un toggle que se recuerda. La vista lista también permite reordenar y mover tareas entre secciones arrastrando.

## Resultado demostrable

1. En el encabezado del tablero, Ana pulsa el toggle **Lista** y la URL pasa a `?vista=lista`.
2. Ve "Por hacer", "En progreso" y "Listo" como encabezados colapsables, con sus tareas en filas debajo.
3. Arrastra una fila de "Por hacer" a "En progreso". Vuelve a **Kanban** y la tarjeta está en la columna correcta.
4. Colapsa "Listo", recarga la página y sigue colapsada. La vista lista también se mantiene.
5. En móvil, la vista lista es la predeterminada la primera vez, porque el kanban exige scroll horizontal.

## Historias de usuario

**H3.1: Como miembro, quiero alternar entre kanban y lista según lo que esté haciendo.**
- El toggle es un `ToggleGroup` con iconos y texto ("Kanban" y "Lista").
- El cambio no recarga datos: ambas vistas leen la misma caché de `useBoard`.
- Prioridad de la vista: `?vista=` en la URL, luego `localStorage` (por tablero) y, por último, el valor por defecto (kanban en escritorio, lista en móvil).

**H3.2: Como miembro, quiero ver mis tareas en filas compactas.**
- Cada fila muestra checkbox, título en una línea, chip de prioridad, fecha límite y los contadores reservados.
- Cada sección muestra un encabezado con nombre, conteo y botón de colapsar, y un "+ Añadir tarea" al final del grupo.
- "Mostrar completadas" funciona igual que en kanban.

**H3.3: Como miembro, quiero reordenar en la vista lista.**
- Las filas se arrastran dentro de su sección o hacia otra.
- Las secciones completas se arrastran desde su encabezado.
- Con teclado funciona igual que en kanban, con anuncios en español.

**H3.4: Como miembro, quiero colapsar secciones que no me interesan ahora.**
- El estado de colapso se guarda por tablero y sección en `localStorage`. Es una preferencia personal, no se comparte.
- Se puede soltar una tarea sobre el encabezado de una sección colapsada: va al final de esa sección.

## Trabajo técnico

### UI
- [ ] `ViewToggle` en `BoardHeader`. Sincroniza `useSearchParams` con `localStorage` mediante un hook `useBoardView(boardId)`.
- [ ] `SectionGroup` (encabezado colapsable con `Collapsible` de shadcn) y `TaskRow`.
- [ ] `ListView`: `SortableContext` vertical para las secciones y otro por sección para las filas. Reutiliza `useMoveTask` y `useMoveSection` sin cambios.
- [ ] Extraer de `KanbanView` la lógica común de `onDragOver`/`onDragEnd` a un hook `useBoardDnd(board)`, para que ambas vistas compartan una sola implementación.
- [ ] Hueco reservado bajo cada fila para las subtareas sangradas: se renderizan en el Sprint 4, pero la estructura ya queda lista.

### Accesibilidad
- [ ] La lista usa `role="list"` y `listitem`, y los encabezados de sección son `h3` reales dentro del botón de colapsar.
- [ ] El foco no se pierde al cambiar de vista: vuelve al toggle.

### Persistencia local
- [ ] Todo el acceso a `localStorage` va envuelto en `try/catch`. Si falla (modo privado), la app funciona con los valores por defecto.
- [ ] Claves: `todo:view:{boardId}` y `todo:collapsed:{boardId}` (array de ids de sección).

## Pruebas
- [ ] Unitarias de `useBoardView`: la URL gana sobre `localStorage`; `localStorage` roto no rompe nada.
- [ ] Test de componente: mover una fila entre secciones con teclado llama a `useMoveTask` con los mismos argumentos que en kanban.
- [ ] Manual: mover en lista, cambiar a kanban y ver lo mismo; colapsar, recargar y seguir colapsado; móvil a 390 px sin scroll horizontal en la vista lista.

## Fuera de este sprint
- Subtareas visibles bajo cada fila (Sprint 4).
- Filtros y búsqueda dentro del tablero. Se pueden traer de la página `/todos` actual en el Sprint 7 si hay tiempo.

## Checklist de cierre
- [ ] Definición de "hecho" del maestro cumplida.
- [ ] Demo de los 5 pasos.
- [ ] Sin lógica de drag and drop duplicada entre kanban y lista.

## Cierre

7 e2e. Hallazgos corregidos: al cambiar de sección el "over" de dnd-kit oscilaba y la tarea caía un puesto corrida (se decide con el puntero y el orden visual); secciones de alturas distintas elegían mal destino (se usa el borde de inicio).
