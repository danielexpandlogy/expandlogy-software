import { memo } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, GripVertical } from "lucide-react";
import type { Task } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { useCreateTask, useUpdateTask } from "../../api/board";
import { boardAnnouncements, screenReaderInstructions } from "../../lib/dnd";
import { positionAtEnd, positionForIndex } from "../../lib/ordering";
import { InlineCreate } from "../board/InlineCreate";
import { TaskCheckbox, TaskMeta } from "../shared/TaskMeta";

interface Props {
  parent: Task;
  subtasks: Task[];
  onOpen: (id: string) => void;
}

export function SubtaskList({ parent, subtasks, onOpen }: Props) {
  const createTask = useCreateTask(parent.board_id);
  const updateTask = useUpdateTask(parent.board_id);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const done = subtasks.filter((s) => s.completed).length;
  const byId = new Map(subtasks.map((s) => [s.id, s]));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = subtasks.map((s) => s.id);
    const to = ids.indexOf(String(over.id));
    const moved = arrayMove(ids, ids.indexOf(String(active.id)), to).map((id) => byId.get(id)!);
    updateTask.mutate({ id: String(active.id), position: positionForIndex(moved, to, String(active.id)) });
  };

  return (
    <section aria-labelledby="subtasks-title" className="space-y-2">
      <h3 id="subtasks-title" className="flex items-center gap-2 text-sm font-semibold">
        Subtareas
        {subtasks.length > 0 && (
          <span className="text-xs font-normal tabular-nums text-muted-foreground">
            {done}/{subtasks.length}
          </span>
        )}
      </h3>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions,
          announcements: boardAnnouncements({
            label: (id) => `la subtarea ${byId.get(id)?.title ?? ""}`,
            place: (id) => ({ section: "las subtareas", index: subtasks.findIndex((s) => s.id === id), total: subtasks.length }),
          }),
        }}
      >
        <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="divide-y rounded-lg border empty:hidden">
            {subtasks.map((s) => (
              <SubtaskRow
                key={s.id}
                task={s}
                onOpen={() => onOpen(s.id)}
                onToggle={(completed) => updateTask.mutate({ id: s.id, completed })}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <InlineCreate
        label="Añadir subtarea"
        placeholder="Nombre de la subtarea"
        className="hover:bg-muted"
        onCreate={(title) =>
          createTask.mutate({ id: crypto.randomUUID(), title, parent_id: parent.id, position: positionAtEnd(subtasks) })
        }
      />
    </section>
  );
}

const SubtaskRow = memo(function SubtaskRow({
  task,
  onOpen,
  onToggle,
}: {
  task: Task;
  onOpen: () => void;
  onToggle: (completed: boolean) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex items-center gap-2 bg-card px-2 py-2", isDragging && "relative z-10 shadow-md")}
    >
      <button
        type="button"
        className="relative z-10 grid size-6 shrink-0 cursor-grab place-items-center rounded text-muted-foreground hover:bg-muted"
        aria-label={`Mover subtarea ${task.title}`}
        {...attributes}
        {...listeners}
        aria-roledescription="subtarea arrastrable"
      >
        <GripVertical className="size-3.5" />
      </button>
      <TaskCheckbox checked={task.completed} onChange={onToggle} />
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-muted/60"
        aria-label={`Abrir subtarea: ${task.title}`}
      >
        <span className={cn("min-w-0 flex-1 truncate text-sm", task.completed && "text-muted-foreground line-through")}>
          {task.title}
        </span>
        <TaskMeta task={task} className="hidden shrink-0 sm:flex [&>span:first-child]:hidden" />
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
});
