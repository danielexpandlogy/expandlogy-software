import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEndEvent, DragOverEvent, DragStartEvent, UniqueIdentifier } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { Section, Task } from "@/lib/database.types";
import { useMoveTask, useUpdateSection } from "../api/board";
import { boardAnnouncements, boardCollisionDetection, dragType, pointerY } from "./dnd";
import { byPosition, positionForIndex } from "./ordering";
import { tasksBySection } from "./tree";

/** sectionId → ids de tareas visibles, en orden. */
export type Containers = Record<string, string[]>;

/**
 * Orden final = lo que el usuario ve al soltar. Tras cambiar de sección, el
 * "over" de dnd-kit oscila mientras re-mide (la tarea recién insertada desplaza
 * a sus vecinas), y un arrayMove con ese over puede dejarla un puesto corrida.
 * Las tarjetas ya muestran su hueco final con transform, así que se ordenan por
 * su posición en pantalla. Sin nodo (sección colapsada) conservan su orden.
 */
export function visualOrder(ids: string[]): string[] {
  const top = (id: string) => {
    const el = document.querySelector(`[data-task-id="${CSS.escape(id)}"]`);
    return el ? el.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
  };
  return ids
    .map((id, i) => ({ id, i, top: top(id) }))
    .sort((a, b) => a.top - b.top || a.i - b.i)
    .map((x) => x.id);
}

interface Options {
  boardId: string;
  layout: "kanban" | "list";
  sections: Section[];
  tasks: Task[];
  showCompleted: boolean;
}

/**
 * Estado y handlers de drag and drop compartidos por kanban y lista.
 *
 * Durante el arrastre se trabaja sobre una copia local de las listas (para
 * mostrar el hueco en la sección destino); al soltar se calcula la nueva clave
 * de orden con los vecinos visibles y se persiste una sola fila. La copia local
 * se mantiene hasta que la caché refleja el cambio, así la tarjeta no "salta"
 * de vuelta un frame antes de la actualización optimista.
 */
export function useBoardDnd({ boardId, layout, sections, tasks, showCompleted }: Options) {
  const moveTask = useMoveTask(boardId);
  const updateSection = useUpdateSection(boardId);

  const sortedSections = useMemo(() => [...sections].sort(byPosition), [sections]);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const sectionById = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);

  const serverContainers = useMemo(() => {
    const map = tasksBySection(tasks, { showCompleted });
    const out: Containers = {};
    for (const s of sortedSections) out[s.id] = (map.get(s.id) ?? []).map((t) => t.id);
    return out;
  }, [tasks, sortedSections, showCompleted]);

  const [dragContainers, setDragContainers] = useState<Containers | null>(null);
  const [sectionOrder, setSectionOrder] = useState<string[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const settling = useRef(false);
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const lastDragEnd = useRef(0);

  const containers = dragContainers ?? serverContainers;
  const sectionIds = sectionOrder ?? sortedSections.map((s) => s.id);
  const containersRef = useRef(containers);
  containersRef.current = containers;
  const sectionIdsRef = useRef(sectionIds);
  sectionIdsRef.current = sectionIds;

  // La caché ya refleja el movimiento (optimista o rollback): se suelta la copia local.
  useEffect(() => {
    if (!settling.current) return;
    settling.current = false;
    setDragContainers(null);
    setSectionOrder(null);
  }, [tasks, sections]);

  const findContainer = useCallback(
    (id: string) => {
      if (id in containersRef.current) return id;
      return Object.keys(containersRef.current).find((k) => containersRef.current[k].includes(id));
    },
    [],
  );

  const collisionDetection = useMemo(
    () =>
      boardCollisionDetection(
        (sectionId) => containersRef.current[sectionId] ?? [],
        lastOverId,
        (taskId) => Object.keys(containersRef.current).find((k) => containersRef.current[k].includes(taskId)),
        layout,
      ),
    [layout],
  );

  const reset = () => {
    setActiveId(null);
    setDragContainers(null);
    setSectionOrder(null);
    lastOverId.current = null;
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    if (dragType(active.data.current) === "task") setDragContainers(serverContainers);
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || dragType(active.data.current) !== "task") return;
    const id = String(active.id);
    const overId = String(over.id);
    const from = findContainer(id);
    const to = findContainer(overId);
    if (!from || !to || from === to) return;

    setDragContainers((prev) => {
      const current = prev ?? serverContainers;
      const target = current[to];
      let index = target.length;
      if (dragType(over.data.current) === "task") {
        const overIndex = target.indexOf(overId);
        // Puntero si lo hay (ratón/dedo); con teclado, el rect trasladado.
        const translated = active.rect.current.translated;
        const y = pointerY(event) ?? (translated ? translated.top + translated.height / 2 : null);
        const below = y !== null && y > over.rect.top + over.rect.height / 2;
        index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : target.length;
      }
      return {
        ...current,
        [from]: current[from].filter((t) => t !== id),
        [to]: [...target.slice(0, index), id, ...target.slice(index)],
      };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    lastDragEnd.current = Date.now();
    const id = String(active.id);
    setActiveId(null);
    lastOverId.current = null;
    if (!over) return reset();

    if (dragType(active.data.current) === "section") {
      const from = sectionIds.indexOf(id);
      const to = sectionIds.indexOf(String(over.id));
      if (from < 0 || to < 0 || from === to) return reset();
      const order = arrayMove(sectionIds, from, to);
      const list = order.map((sid) => sectionById.get(sid)!);
      settling.current = true;
      setSectionOrder(order);
      updateSection.mutate({ id, position: positionForIndex(list, to, id) });
      return;
    }

    const sectionId = findContainer(id);
    if (!sectionId) return reset();
    const items = visualOrder(containersRef.current[sectionId]);
    const index = items.indexOf(id);
    const original = taskById.get(id);
    const unchanged =
      original?.section_id === sectionId && serverContainers[sectionId]?.indexOf(id) === index;
    if (!original || unchanged) return reset();

    const list = items.map((tid) => taskById.get(tid)!).filter(Boolean);
    settling.current = true;
    setDragContainers({ ...containersRef.current, [sectionId]: items });
    moveTask.mutate({ id, section_id: sectionId, position: positionForIndex(list, index, id) });
  };

  const announcements = useMemo(
    () =>
      boardAnnouncements({
        label: (id) => {
          const t = taskById.get(id);
          if (t) return `la tarea ${t.title}`;
          const s = sectionById.get(id);
          return s ? `la sección ${s.name}` : "el elemento";
        },
        place: (id) => {
          if (sectionById.has(id)) {
            const index = sectionIds.indexOf(id);
            return { section: "el tablero", index, total: sectionIds.length };
          }
          const sid = findContainer(id);
          if (!sid) return null;
          const list = containersRef.current[sid];
          return { section: sectionById.get(sid)?.name ?? "", index: list.indexOf(id), total: list.length };
        },
      }),
    [taskById, sectionById, sectionIds, findContainer],
  );

  const justDragged = useCallback(() => Date.now() - lastDragEnd.current < 250, []);

  // Acceso estable (por refs) para el sensor de teclado: no recrea los sensores.
  const layoutAccess = useMemo(
    () => ({
      sectionIds: () => sectionIdsRef.current,
      items: (sectionId: string) => containersRef.current[sectionId] ?? [],
      containerOf: findContainer,
    }),
    [findContainer],
  );

  return {
    layoutAccess,
    containers,
    sectionIds,
    activeId,
    activeTask: activeId ? (taskById.get(activeId) ?? null) : null,
    activeSection: activeId ? (sectionById.get(activeId) ?? null) : null,
    taskById,
    sectionById,
    /** Evita que el clic que cierra un arrastre abra la tarjeta. */
    justDragged,
    dndProps: {
      collisionDetection,
      onDragStart,
      onDragOver,
      onDragEnd,
      onDragCancel: reset,
      accessibility: { announcements },
    },
  };
}
