import {
  getFirstCollision,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DroppableContainer,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export type DragType = "task" | "section";

export interface DragData {
  type: DragType;
  /** Sección a la que pertenece la tarea (sólo type = task). */
  sectionId?: string;
}

export const dragType = (data: unknown): DragType | undefined => (data as DragData | undefined)?.type;

export interface BoardLayout {
  /** "kanban": secciones en columnas; "list": secciones apiladas. */
  layout: "kanban" | "list";
  sectionIds: () => string[];
  items: (sectionId: string) => string[];
  containerOf: (id: string) => string | undefined;
}

/**
 * Teclado para listas múltiples. Con el algoritmo por defecto, la flecha elige
 * "el droppable más cercano en esa dirección", que a menudo es la propia
 * sección y no la siguiente. Aquí:
 * - kanban: ←/→ saltan a la sección vecina (primer hueco); ↑/↓ dentro de la sección.
 * - lista: ↑/↓ dentro de la sección y, en los bordes, a la sección vecina.
 * - secciones: se mueven entre secciones en el eje del layout.
 */
export function boardKeyboardCoordinates(board: BoardLayout): KeyboardCoordinateGetter {
  return (event, args) => {
    const { active, droppableRects, droppableContainers, collisionRect } = args.context;
    const code = event.code;
    if (!active || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(code)) return undefined;
    event.preventDefault();

    const back = code === "ArrowLeft" || code === "ArrowUp";
    const vertical = code === "ArrowUp" || code === "ArrowDown";
    const rectOf = (id: string | undefined) => {
      const r = id ? droppableRects.get(id) : undefined;
      return r ? { x: r.left, y: r.top } : undefined;
    };
    // Al saltar de sección: el centro de la tarjeta justo encima (o debajo) del
    // ancla, para que "antes/después" no dependa de las alturas de las tarjetas.
    const half = (collisionRect?.height ?? 0) / 2;
    const beside = (id: string | undefined, where: "before" | "after") => {
      const r = id ? droppableRects.get(id) : undefined;
      if (!r) return undefined;
      return { x: r.left, y: where === "before" ? r.top - half - 1 : r.bottom - half + 1 };
    };
    const sections = board.sectionIds();
    const neighbor = (sectionId: string) => sections[sections.indexOf(sectionId) + (back ? -1 : 1)];
    const id = String(active.id);

    // Secciones: se mueven en el eje del layout.
    if (dragType(active.data.current) === "section") {
      if (vertical !== (board.layout === "list")) return undefined;
      return rectOf(neighbor(id));
    }

    const container = board.containerOf(id);
    if (!container) return undefined;

    // Kanban ←/→: primer hueco de la sección vecina (o la sección, si está vacía).
    if (!vertical) {
      if (board.layout === "list") return undefined;
      const target = neighbor(container);
      if (!target) return undefined;
      return beside(board.items(target).find((t) => t !== id), "before") ?? rectOf(target);
    }

    // ↑/↓ dentro de la sección: el algoritmo por defecto, limitado a sus tareas.
    const allowed = new Set(board.items(container));
    const subset = droppableContainers.getEnabled().filter((c: DroppableContainer) => allowed.has(String(c.id)));
    const within = sortableKeyboardCoordinates(event, {
      ...args,
      context: {
        ...args.context,
        // Sólo se usan getEnabled() y get(); el resto del mapa no hace falta.
        droppableContainers: {
          getEnabled: () => subset,
          get: (key: UniqueIdentifier) => droppableContainers.get(key),
        } as unknown as typeof droppableContainers,
      },
    });
    if (within || board.layout === "kanban") return within;

    // Lista, en el borde: a la sección vecina (al final si sube, al inicio si baja).
    const target = neighbor(container);
    if (!target) return undefined;
    const targetItems = board.items(target);
    // Si la sección vecina está colapsada sus tareas no están montadas: a la sección.
    return (
      (back ? beside(targetItems[targetItems.length - 1], "after") : beside(targetItems[0], "before")) ?? rectOf(target)
    );
  };
}

export function useBoardSensors(board: BoardLayout) {
  return useSensors(
    // Ratón y dedo por separado: un PointerSensor también recibe los toques y
    // competiría con el scroll horizontal del kanban en móvil.
    // 5 px: un clic sin mover abre la tarjeta en vez de arrastrarla.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Mantener pulsado 200 ms en táctil; deslizar sin esperar hace scroll.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    // Espacio levanta y suelta; Enter queda libre para abrir la tarea.
    useSensor(KeyboardSensor, {
      coordinateGetter: boardKeyboardCoordinates(board),
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
}

/**
 * Colisiones para listas múltiples (secciones con tareas):
 * - Arrastrando una sección sólo cuentan otras secciones.
 * - Arrastrando una tarea sobre una sección con tareas, se afina a la tarea
 *   más cercana dentro de esa sección; si está vacía, la sección misma.
 */
export function boardCollisionDetection(
  getItems: (sectionId: string) => string[],
  lastOverId: { current: UniqueIdentifier | null },
  sectionOfTask: (taskId: string) => string | undefined,
  layout: "kanban" | "list",
): CollisionDetection {
  return (args) => {
    if (dragType(args.active.data.current) === "section") {
      // Las secciones de la lista tienen alturas muy distintas: comparar centros
      // elige mal. Gana la sección cuyo borde de inicio (arriba en lista,
      // izquierda en kanban) está más cerca del puntero o, con teclado, del rect.
      const rect = args.collisionRect;
      const point = args.pointerCoordinates ?? (rect ? { x: rect.left, y: rect.top } : null);
      if (!point) return [];
      let best: UniqueIdentifier | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const c of args.droppableContainers) {
        if (dragType(c.data.current) !== "section") continue;
        const r = args.droppableRects.get(c.id);
        if (!r) continue;
        const d = layout === "list" ? Math.abs(point.y - r.top) : Math.abs(point.x - r.left);
        if (d < bestDistance) {
          bestDistance = d;
          best = c.id;
        }
      }
      return best ? [{ id: best }] : [];
    }

    const pointer = pointerWithin(args);
    const hits = pointer.length ? pointer : rectIntersection(args);
    const overId = getFirstCollision(hits, "id");

    if (overId != null) {
      const container = args.droppableContainers.find((c) => c.id === overId);
      const sectionId = dragType(container?.data.current) === "section" ? String(overId) : sectionOfTask(String(overId));
      const refined = sectionId ? overWithinSection(args, getItems(sectionId)) : null;
      const id = refined ?? overId;
      lastOverId.current = id;
      return [{ id }];
    }

    return lastOverId.current ? [{ id: lastOverId.current }] : [];
  };
}

/**
 * Dentro de una sección, el destino se decide contra las vecinas y nunca
 * contra el rectángulo de la propia tarea arrastrada: al cambiar de sección su
 * nodo se vuelve a montar y durante unos frames dnd-kit usa su rectángulo viejo,
 * lo que hacía oscilar el "over" y soltaba la tarea un puesto corrida.
 *
 * Con la vecina más cercana C (por centro vertical) y la semántica de sortable
 * (la activa termina en el índice del "over"):
 * - encima de C → si la activa estaba arriba de C, over = la anterior a C; si no, C.
 * - debajo de C → si la activa estaba arriba de C, over = C; si no, la siguiente a C.
 */
/** Y actual del puntero en un evento de dnd-kit, o null con teclado. */
export function pointerY(event: { activatorEvent: Event | null; delta: { y: number } }): number | null {
  const e = event.activatorEvent;
  if (!e) return null;
  if ("touches" in e && (e as TouchEvent).touches.length) return (e as TouchEvent).touches[0].clientY + event.delta.y;
  if ("clientY" in e && !(e instanceof KeyboardEvent)) return (e as MouseEvent).clientY + event.delta.y;
  return null;
}

function overWithinSection(args: Parameters<CollisionDetection>[0], items: string[]): UniqueIdentifier | null {
  const activeId = String(args.active.id);
  const others = items.filter((id) => id !== activeId);
  const rect = args.collisionRect;
  if (!others.length || !rect) return null;
  // Con ratón o dedo manda el puntero: el collisionRect se desplaza cuando el
  // nodo activo se vuelve a montar en otra sección. Con teclado no hay puntero
  // y el rect es exacto (lo fija boardKeyboardCoordinates).
  const centerY = args.pointerCoordinates?.y ?? rect.top + rect.height / 2;

  let closest: string | null = null;
  let closestCenter = 0;
  let best = Number.POSITIVE_INFINITY;
  for (const id of others) {
    const r = args.droppableRects.get(id);
    if (!r) continue;
    const c = r.top + r.height / 2;
    if (Math.abs(c - centerY) < best) {
      best = Math.abs(c - centerY);
      closest = id;
      closestCenter = c;
    }
  }
  if (!closest) return null;

  const ai = items.indexOf(activeId);
  const ci = items.indexOf(closest);
  if (ai === -1) return closest; // todavía no está en esta sección: onDragOver decide antes/después
  const above = centerY < closestCenter;
  if (above) return ai < ci ? items[ci - 1] : closest;
  return ai < ci ? closest : (items[ci + 1] ?? closest);
}

export const screenReaderInstructions = {
  draggable:
    "Para mover este elemento, pulsa Espacio. Usa las flechas para cambiarlo de lugar y Espacio de nuevo para soltarlo. Pulsa Escape para cancelar.",
};

interface Describe {
  /** Nombre legible de una tarea o sección. */
  label: (id: string) => string;
  /** Dónde está ahora: sección, posición y total. */
  place: (id: string) => { section: string; index: number; total: number } | null;
}

export function boardAnnouncements({ label, place }: Describe): Announcements {
  const where = (id: string) => {
    const p = place(id);
    return p ? `${p.section}, posición ${p.index + 1} de ${p.total}` : "";
  };
  return {
    onDragStart: ({ active }) => `Levantaste ${label(String(active.id))}. Está en ${where(String(active.id))}.`,
    onDragOver: ({ active, over }) => {
      // Al levantar, dnd-kit reporta "over" sobre el propio ítem: no es un movimiento.
      if (over?.id === active.id) return undefined;
      return over
        ? `${label(String(active.id))} se movió a ${where(String(active.id))}.`
        : `${label(String(active.id))} está fuera de las secciones.`;
    },
    onDragEnd: ({ active, over }) =>
      over ? `Soltaste ${label(String(active.id))} en ${where(String(active.id))}.` : `Soltaste ${label(String(active.id))}.`,
    onDragCancel: ({ active }) => `Movimiento cancelado. ${label(String(active.id))} volvió a su lugar.`,
  };
}
