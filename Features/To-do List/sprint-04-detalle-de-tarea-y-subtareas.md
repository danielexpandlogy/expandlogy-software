# Sprint 4: Detalle de tarea, subtareas y recordatorio (Beta)

| | |
|---|---|
| **Estado** | ✅ Completado (2026-09-29) |
| **Duración estimada** | 1 semana |
| **Depende de** | Sprint 2. Del Sprint 3 solo depende el paso de mostrar subtareas en la vista lista |
| **Maestro** | [00-documento-maestro.md](00-documento-maestro.md) |

## Objetivo

Que cada tarjeta se abra en un **panel de detalle** donde se edita todo: título, descripción, prioridad, fecha límite, **recordatorio** (solo UI, con badge **Beta**) y **subtareas**. El panel tiene su propia URL para poder compartir o recargar sin perder la tarea abierta.

## Resultado demostrable

1. Ana hace clic en la tarjeta "Llamar a proveedor". Se abre un panel lateral y la URL pasa a `/todos/:boardId/t/:taskId`.
2. Cambia el título y escribe una descripción de varias líneas. Al cerrar y reabrir, todo se guardó sin pulsar ningún botón.
3. Pulsa **Recordatorio**: ve el badge **Beta**, elige "Mañana 9:00" y la tarjeta muestra un icono de campana con la fecha. El tooltip dice "Las notificaciones por email y push llegarán pronto".
4. Añade 3 subtareas y completa una. La tarjeta muestra `1/3`.
5. Abre una subtarea: el panel muestra la subtarea con un enlace "← Llamar a proveedor" para volver a la tarea padre. **No hay opción de añadir subtareas dentro de una subtarea.**
6. En la vista lista, las subtareas aparecen sangradas bajo su tarea, con un botón para plegarlas.

## Historias de usuario

**H4.1: Como miembro, quiero ver y editar todos los datos de una tarea.**
- El panel es un `Sheet` a la derecha en escritorio (ancho 560 px) y a pantalla completa en móvil.
- Título editable en línea; no se permite vacío (vuelve al valor anterior).
- Descripción en un `Textarea` que crece con el texto. Se guarda al perder el foco y también con debounce de 800 ms mientras se escribe. Un indicador discreto muestra "Guardando…" y luego "Guardado".
- Prioridad y fecha límite con los mismos controles que hoy tiene `TodoDialog`.
- Datos al pie: sección actual (con selector para moverla), creada por y fecha de creación.
- Acciones: Completar, Eliminar (con confirmación que advierte que se borran sus subtareas y comentarios) y Copiar enlace.

**H4.2: Como miembro, quiero ponerle un recordatorio a una tarea, aunque aún no me avise.**
- Botón "Recordatorio" con el badge **Beta** siempre visible junto al texto.
- `Popover` con atajos ("Hoy 18:00", "Mañana 9:00", "Próximo lunes 9:00") y, además, fecha y hora personalizadas.
- No se permite una fecha pasada; el botón se deshabilita con el mensaje "Elige una fecha futura".
- Se guarda en `tasks.reminder_at` (timestamptz, hora local del usuario convertida a UTC).
- La tarjeta y la fila muestran 🔔 con la fecha corta.
- **No se envía nada.** Ningún job ni Edge Function lee `reminder_at` en este feature.
- El `Popover` explica: "Beta: por ahora el recordatorio queda guardado, pero todavía no envía notificaciones."

**H4.3: Como miembro, quiero dividir una tarea en subtareas.**
- Sección "Subtareas" en el panel con la lista, un checkbox por subtarea y "+ Añadir subtarea" (en línea; Enter encadena la siguiente).
- Las subtareas se reordenan con drag and drop dentro de su tarea, usando `ordering.ts` y un `SortableContext` vertical.
- Cada subtarea tiene título, descripción, prioridad, fecha límite y recordatorio, igual que una tarea. Se abre en el mismo panel.
- La subtarea abierta **no muestra** la sección "Subtareas". La base de datos también lo impide (trigger del Sprint 1).
- Completar la tarea padre **no** completa las subtareas automáticamente, igual que en Todoist. Si quedan subtareas pendientes, el panel lo advierte.

**H4.4: Como miembro, quiero ver el avance de las subtareas desde el tablero.**
- La tarjeta y la fila muestran `completadas/total` cuando hay al menos una subtarea.
- En la vista lista, un chevron despliega las subtareas sangradas (24 px). Se pueden completar desde ahí.

## Trabajo técnico

### Datos
- [ ] `useBoard(boardId)` ya trae todas las tareas del tablero (Sprint 1). En el cliente, las subtareas se agrupan por `parent_id` con un selector memoizado. No hacen falta consultas extra.
- [ ] `useUpdateTask(taskId, patch)` genérico con actualización optimista. Lo reutilizan el título, la descripción, la prioridad, la fecha, el recordatorio y la sección.
- [ ] `useCreateSubtask(parentId)`: hereda `board_id` del padre, `section_id = null` y `position` al final.
- [ ] `useDeleteTask`: borra por cascada las subtareas; el trigger ya lo gestiona.

### UI
- [ ] Ruta anidada `t/:taskId` dentro de `BoardPage`; el panel se monta sobre el tablero. Cerrar el panel navega a `/todos/:boardId` conservando `?vista=`.
- [ ] Si la tarea no existe o fue borrada, toast "La tarea ya no existe" y el panel se cierra.
- [ ] Componentes `TaskDetailSheet`, `EditableTitle`, `AutosizeDescription`, `ReminderPicker` (con `BetaBadge` reutilizable), `SubtaskList` y `SubtaskRow`.
- [ ] `BetaBadge`: pequeño, en mayúsculas, con fondo `accent`; queda disponible para futuros features experimentales.
- [ ] Añadir los contadores de subtareas a `TaskCard` y `TaskRow`.
- [ ] Las teclas de acceso rápido dentro del panel (Esc cierra, Ctrl/⌘+Enter completa) no se disparan mientras se escribe en un input.

### Base de datos
- [ ] Sin tablas nuevas. Si hace falta, añadir el check `reminder_at is null or reminder_at > created_at`. Validar la fecha futura en el cliente es suficiente para v1.

## Pruebas
- [ ] Unitarias: selector de subtareas por padre (orden por `position`); presets de `ReminderPicker` calculados en la zona local ("Próximo lunes" un lunes = el de la semana siguiente).
- [ ] Test de componente: al abrir una subtarea no se renderiza "+ Añadir subtarea".
- [ ] RLS: insertar vía API una subtarea con `parent_id` de otra subtarea → error del trigger; insertar una subtarea en un tablero ajeno → rechazada.
- [ ] Manual: el autoguardado de la descripción no pierde texto al cerrar el panel justo después de escribir (flush en `onClose`).

## Fuera de este sprint
- Comentarios en el panel (Sprint 5); el espacio queda reservado bajo las subtareas.
- Enviar recordatorios (fuera del feature).

## Checklist de cierre
- [ ] Definición de "hecho" del maestro cumplida.
- [ ] Demo de los 6 pasos.
- [ ] El badge Beta y su texto explicativo, revisados por el dueño de producto.

## Cierre

9 e2e, 6 verificaciones de RLS. Función `board_people` para mostrar nombres de autores sin abrir `profiles`. Esc dentro de un campo no cierra el panel.
