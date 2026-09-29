import { memo, useCallback, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay, MeasuringStrategy } from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Section, Task } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { useCreateSection, useUpdateSection, useUpdateTask } from "../../api/board";
import { screenReaderInstructions, useBoardSensors } from "../../lib/dnd";
import { positionAtEnd } from "../../lib/ordering";
import { subtaskProgress, subtasksByParent, type BoardData } from "../../lib/tree";
import { useBoardDnd } from "../../lib/use-board-dnd";
import { AddTaskButton, InlineCreate } from "./InlineCreate";
import { SectionMenu, SectionNameInput } from "./SectionMenu";
import { TaskCard } from "./TaskCard";

interface Props {
  data: BoardData;
  showCompleted: boolean;
  onOpenTask: (taskId: string) => void;
  /** "Añadir tarea" abre el formulario completo en esa sección. */
  onAddTask: (sectionId: string) => void;
}

export function KanbanView({ data, showCompleted, onOpenTask, onAddTask }: Props) {
  const boardId = data.board.id;
  const dnd = useBoardDnd({ boardId, layout: "kanban", sections: data.sections, tasks: data.tasks, showCompleted });
  const layout = useMemo(() => ({ layout: "kanban" as const, ...dnd.layoutAccess }), [dnd.layoutAccess]);
  const sensors = useBoardSensors(layout);
  const createSection = useCreateSection(boardId);
  const subtasks = useMemo(() => subtasksByParent(data.tasks), [data.tasks]);
  const progress = useMemo(() => new Map([...subtasks].map(([id, list]) => [id, subtaskProgress(list)])), [subtasks]);

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
      <div
        className="-mx-4 flex h-[calc(100svh-13rem)] min-h-[24rem] snap-x snap-mandatory scroll-px-4 items-start gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:snap-none md:px-0"
        data-testid="kanban"
      >
        <SortableContext items={dnd.sectionIds} strategy={horizontalListSortingStrategy}>
          {dnd.sectionIds.map((sectionId) => {
            const section = dnd.sectionById.get(sectionId);
            if (!section) return null;
            return (
              <SortableSection
                key={sectionId}
                section={section}
                taskIds={dnd.containers[sectionId] ?? []}
                taskById={dnd.taskById}
                progress={progress}
                commentCounts={data.commentCounts}
                allTasks={data.tasks}
                activeId={dnd.activeId}
                onOpenTask={open}
                onAddTask={onAddTask}
              />
            );
          })}
        </SortableContext>

        <div className="w-[85vw] shrink-0 snap-start sm:w-72">
          <InlineCreate
            label="Añadir sección"
            placeholder="Nombre de la sección"
            maxLength={120}
            chain={false}
            className="bg-muted/60"
            onCreate={(name) =>
              createSection.mutate({ id: crypto.randomUUID(), name, position: positionAtEnd(data.sections) })
            }
          />
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {dnd.activeTask ? (
          <TaskCard
            task={dnd.activeTask}
            subtasks={progress.get(dnd.activeTask.id) ?? null}
            comments={data.commentCounts[dnd.activeTask.id]}
            overlay
            className="w-72"
          />
        ) : dnd.activeSection ? (
          <div className="w-72 rotate-1 rounded-xl bg-muted p-3 shadow-lg ring-1 ring-primary/30">
            <p className="text-sm font-semibold">{dnd.activeSection.name}</p>
            <p className="text-xs text-muted-foreground">{dnd.containers[dnd.activeSection.id]?.length ?? 0} tareas</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface SectionProps {
  section: Section;
  taskIds: string[];
  taskById: Map<string, Task>;
  progress: Map<string, { done: number; total: number } | null>;
  commentCounts: Record<string, number>;
  allTasks: Task[];
  activeId: string | null;
  onOpenTask: (id: string) => void;
  onAddTask: (sectionId: string) => void;
}

function SortableSection({ section, taskIds, taskById, progress, commentCounts, allTasks, activeId, onOpenTask, onAddTask }: SectionProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: section.id,
    data: { type: "section" },
  });
  const updateSection = useUpdateSection(section.board_id);
  const [renaming, setRenaming] = useState(false);

  // Todas las tareas de la sección (también completadas ocultas), para el orden y el borrado.
  const sectionTasks = useMemo(
    () => allTasks.filter((t) => t.section_id === section.id && t.parent_id === null),
    [allTasks, section.id],
  );

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-label={`Sección ${section.name}`}
      className={cn(
        "flex max-h-full w-[85vw] shrink-0 snap-start flex-col rounded-xl bg-muted/60 sm:w-72",
        isDragging && "opacity-40",
      )}
    >
      <header className="flex items-center gap-1 px-2 pb-1 pt-2">
        <button
          type="button"
          className="grid size-7 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-background/70 active:cursor-grabbing"
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
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold" onDoubleClick={() => setRenaming(true)}>
            {section.name}
            <span className="ml-2 text-xs font-normal tabular-nums text-muted-foreground">{taskIds.length}</span>
          </h3>
        )}
        <SectionMenu section={section} taskCount={sectionTasks.length} onRename={() => setRenaming(true)} />
      </header>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-12 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-1 pt-1" role="list">
          {taskIds.map((id) => {
            const task = taskById.get(id);
            if (!task) return null;
            return (
              <SortableTaskCard
                key={id}
                task={task}
                sectionId={section.id}
                subtasks={progress.get(id) ?? null}
                comments={commentCounts[id]}
                hidden={activeId === id}
                onOpen={onOpenTask}
              />
            );
          })}
        </div>
      </SortableContext>

      <div className="px-2 pb-2">
        <AddTaskButton onClick={() => onAddTask(section.id)} />
      </div>
    </section>
  );
}

interface CardProps {
  task: Task;
  sectionId: string;
  subtasks: { done: number; total: number } | null;
  comments?: number;
  hidden: boolean;
  onOpen: (id: string) => void;
}

const SortableTaskCard = memo(function SortableTaskCard({ task, sectionId, subtasks, comments, hidden, onOpen }: CardProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition } = useSortable({
    id: task.id,
    data: { type: "task", sectionId },
  });
  const updateTask = useUpdateTask(task.board_id);

  return (
    <div role="listitem">
      <TaskCard
        ref={setNodeRef}
        task={task}
        subtasks={subtasks}
        comments={comments}
        dragging={hidden}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        onOpen={() => onOpen(task.id)}
        onToggle={(completed) => updateTask.mutate({ id: task.id, completed })}
        handle={{ ref: setActivatorNodeRef, ...attributes, ...listeners, "aria-roledescription": "tarea arrastrable" }}
        data-task-id={task.id}
      />
    </div>
  );
});
