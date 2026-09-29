import { memo, useCallback, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay, MeasuringStrategy } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, GripVertical } from "lucide-react";
import type { Section, Task } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { useCreateSection, useCreateTask, useUpdateSection, useUpdateTask } from "../../api/board";
import { screenReaderInstructions, useBoardSensors } from "../../lib/dnd";
import { positionAtEnd } from "../../lib/ordering";
import { subtaskProgress, subtasksByParent, type BoardData } from "../../lib/tree";
import { useBoardDnd } from "../../lib/use-board-dnd";
import { useLocalState } from "../../lib/use-local-state";
import { InlineCreate } from "../board/InlineCreate";
import { SectionMenu, SectionNameInput } from "../board/SectionMenu";
import { TaskRow } from "./TaskRow";

interface Props {
  data: BoardData;
  showCompleted: boolean;
  onOpenTask: (taskId: string) => void;
}

export function ListView({ data, showCompleted, onOpenTask }: Props) {
  const boardId = data.board.id;
  const dnd = useBoardDnd({ boardId, layout: "list", sections: data.sections, tasks: data.tasks, showCompleted });
  const layout = useMemo(() => ({ layout: "list" as const, ...dnd.layoutAccess }), [dnd.layoutAccess]);
  const sensors = useBoardSensors(layout);
  const createSection = useCreateSection(boardId);
  const subtasks = useMemo(() => subtasksByParent(data.tasks), [data.tasks]);
  // Preferencia personal por dispositivo, no se comparte.
  const [collapsed, setCollapsed] = useLocalState<string[]>(`todo:collapsed:${boardId}`, []);
  const [expanded, setExpanded] = useLocalState<string[]>(`todo:expanded:${boardId}`, []);
  const toggleExpanded = (taskId: string) =>
    setExpanded((prev) => (prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]));

  // Estable: las tarjetas están memorizadas y un callback nuevo por render
  // haría que las 500 se volvieran a pintar al levantar una.
  const { justDragged, activeId } = dnd;
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  const open = useCallback(
    (id: string) => {
      if (!justDragged() && !activeRef.current) onOpenTask(id);
    },
    [justDragged, onOpenTask],
  );
  const toggleCollapsed = (sectionId: string) =>
    setCollapsed((prev) => (prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]));

  return (
    <DndContext
      sensors={sensors}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      accessibility={{ ...dnd.dndProps.accessibility, screenReaderInstructions }}
      collisionDetection={dnd.dndProps.collisionDetection}
      onDragStart={dnd.dndProps.onDragStart}
      onDragOver={dnd.dndProps.onDragOver}
      onDragEnd={dnd.dndProps.onDragEnd}
      onDragCancel={dnd.dndProps.onDragCancel}
    >
      <div className="mx-auto max-w-4xl space-y-4 pb-8" data-testid="list-view">
        <SortableContext items={dnd.sectionIds} strategy={verticalListSortingStrategy}>
          {dnd.sectionIds.map((sectionId) => {
            const section = dnd.sectionById.get(sectionId);
            if (!section) return null;
            return (
              <SortableSectionGroup
                key={sectionId}
                section={section}
                taskIds={dnd.containers[sectionId] ?? []}
                taskById={dnd.taskById}
                subtasks={subtasks}
                commentCounts={data.commentCounts}
                allTasks={data.tasks}
                activeId={dnd.activeId}
                collapsed={collapsed.includes(sectionId)}
                onToggleCollapsed={() => toggleCollapsed(sectionId)}
                expanded={expanded}
                onToggleExpanded={toggleExpanded}
                showCompleted={showCompleted}
                onOpenTask={open}
              />
            );
          })}
        </SortableContext>

        <InlineCreate
          label="Añadir sección"
          placeholder="Nombre de la sección"
          maxLength={120}
          chain={false}
          onCreate={(name) => createSection.mutate({ id: crypto.randomUUID(), name, position: positionAtEnd(data.sections) })}
        />
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {dnd.activeTask ? (
          <TaskRow task={dnd.activeTask} subtasks={subtaskProgress(subtasks.get(dnd.activeTask.id))} overlay />
        ) : dnd.activeSection ? (
          <div className="rounded-lg border bg-card px-4 py-2.5 text-sm font-semibold shadow-lg ring-1 ring-primary/30">
            {dnd.activeSection.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface GroupProps {
  section: Section;
  taskIds: string[];
  taskById: Map<string, Task>;
  subtasks: Map<string, Task[]>;
  commentCounts: Record<string, number>;
  allTasks: Task[];
  activeId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  expanded: string[];
  onToggleExpanded: (taskId: string) => void;
  showCompleted: boolean;
  onOpenTask: (id: string) => void;
}

function SortableSectionGroup({
  section,
  taskIds,
  taskById,
  subtasks,
  commentCounts,
  allTasks,
  activeId,
  collapsed,
  onToggleCollapsed,
  expanded,
  onToggleExpanded,
  showCompleted,
  onOpenTask,
}: GroupProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: section.id,
    data: { type: "section" },
  });
  const createTask = useCreateTask(section.board_id);
  const updateSection = useUpdateSection(section.board_id);
  const [renaming, setRenaming] = useState(false);
  const sectionTasks = useMemo(
    () => allTasks.filter((t) => t.section_id === section.id && t.parent_id === null),
    [allTasks, section.id],
  );
  const bodyId = `section-body-${section.id}`;

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-label={`Sección ${section.name}`}
      className={cn("rounded-xl border bg-card", isDragging && "opacity-40")}
    >
      <header className={cn("flex items-center gap-1 px-2 py-1.5", !collapsed && "border-b")}>
        <button
          type="button"
          className="grid size-7 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          aria-label={`Mover sección ${section.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        {renaming ? (
          <SectionNameInput
            section={section}
            onDone={(name) => {
              setRenaming(false);
              if (name) updateSection.mutate({ id: section.id, name });
            }}
          />
        ) : (
          <h3 className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-expanded={!collapsed}
              aria-controls={bodyId}
              className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-left text-sm font-semibold hover:bg-muted"
            >
              <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !collapsed && "rotate-90")} />
              <span className="truncate">{section.name}</span>
              <span className="text-xs font-normal tabular-nums text-muted-foreground">{taskIds.length}</span>
            </button>
          </h3>
        )}
        <SectionMenu section={section} taskCount={sectionTasks.length} onRename={() => setRenaming(true)} />
      </header>

      {!collapsed && (
        <div id={bodyId}>
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <div role="list" className="divide-y">
              {taskIds.map((id) => {
                const task = taskById.get(id);
                if (!task) return null;
                return (
                  <SortableTaskRow
                    key={id}
                    task={task}
                    sectionId={section.id}
                    subtasks={subtasks.get(id)}
                    comments={commentCounts[id]}
                    hidden={activeId === id}
                    expanded={expanded.includes(id)}
                    onToggleExpanded={onToggleExpanded}
                    showCompleted={showCompleted}
                    onOpen={onOpenTask}
                  />
                );
              })}
            </div>
          </SortableContext>
          <div className={cn("px-2 py-1", taskIds.length > 0 && "border-t")}>
            <InlineCreate
              label="Añadir tarea"
              placeholder="Nombre de la tarea"
              className="hover:bg-muted"
              onCreate={(title) =>
                createTask.mutate({ id: crypto.randomUUID(), title, section_id: section.id, position: positionAtEnd(sectionTasks) })
              }
            />
          </div>
        </div>
      )}
    </section>
  );
}

interface RowProps {
  task: Task;
  sectionId: string;
  subtasks: Task[] | undefined;
  comments?: number;
  hidden: boolean;
  expanded: boolean;
  onToggleExpanded: (taskId: string) => void;
  showCompleted: boolean;
  onOpen: (id: string) => void;
}

const SortableTaskRow = memo(function SortableTaskRow({
  task,
  sectionId,
  subtasks,
  comments,
  hidden,
  expanded,
  onToggleExpanded,
  showCompleted,
  onOpen,
}: RowProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition } = useSortable({
    id: task.id,
    data: { type: "task", sectionId },
  });
  const updateTask = useUpdateTask(task.board_id);
  const visibleSubtasks = (subtasks ?? []).filter((s) => showCompleted || !s.completed);
  const hasSubtasks = !!subtasks?.length;
  const subtasksId = `subtasks-${task.id}`;

  return (
    // El nodo medido es el bloque completo (fila + subtareas), así se desplaza entero.
    <div role="listitem" ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}>
      <TaskRow
        task={task}
        subtasks={subtaskProgress(subtasks)}
        comments={comments}
        dragging={hidden}
        onOpen={() => onOpen(task.id)}
        onToggle={(completed) => updateTask.mutate({ id: task.id, completed })}
        leading={
          <button
            type="button"
            tabIndex={hasSubtasks ? 0 : -1}
            aria-hidden={!hasSubtasks}
            aria-expanded={hasSubtasks ? expanded : undefined}
            aria-controls={hasSubtasks ? subtasksId : undefined}
            aria-label={hasSubtasks ? `${expanded ? "Ocultar" : "Mostrar"} subtareas de ${task.title}` : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (hasSubtasks) onToggleExpanded(task.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className={cn(
              "-ml-1 -mr-1.5 grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted sm:mt-0",
              !hasSubtasks && "invisible",
            )}
          >
            <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
          </button>
        }
        handle={{ ref: setActivatorNodeRef, ...attributes, ...listeners, "aria-roledescription": "tarea arrastrable" }}
        data-task-id={task.id}
      />
      {hasSubtasks && expanded && !hidden && (
        <div id={subtasksId} role="list" aria-label={`Subtareas de ${task.title}`} className="divide-y border-t">
          {visibleSubtasks.map((sub) => (
            <div role="listitem" key={sub.id}>
              <TaskRow
                task={sub}
                indent
                onOpen={() => onOpen(sub.id)}
                onToggle={(completed) => updateTask.mutate({ id: sub.id, completed })}
                className="bg-muted/20"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
