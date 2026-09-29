import { forwardRef, memo, type HTMLAttributes, type Ref } from "react";
import type { Task } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { TaskCheckbox, TaskMeta } from "../shared/TaskMeta";

export interface TaskHandleProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

interface Props extends HTMLAttributes<HTMLDivElement> {
  task: Task;
  subtasks?: { done: number; total: number } | null;
  comments?: number;
  onToggle?: (completed: boolean) => void;
  onOpen?: () => void;
  /** Atributos/listeners de arrastre (dnd-kit) para el área que abre la tarea. */
  handle?: TaskHandleProps;
  /** Estado visual mientras se arrastra (el hueco o el "fantasma"). */
  dragging?: boolean;
  overlay?: boolean;
}

/**
 * Tarjeta del kanban. El checkbox y el área que abre/arrastra son hermanos (no
 * uno dentro del otro): un botón con otro control dentro confunde a los
 * lectores de pantalla. El área de abrir se estira sobre toda la tarjeta con un
 * pseudo-elemento, así un clic o arrastre en cualquier punto funciona igual.
 */
export const TaskCard = memo(
  forwardRef<HTMLDivElement, Props>(function TaskCard(
    { task, subtasks, comments, onToggle, onOpen, handle, dragging, overlay, className, ...rest },
    ref,
  ) {
    const { ref: handleRef, onKeyDown, ...handleProps } = handle ?? {};
    return (
      <div
        {...rest}
        ref={ref}
        className={cn(
          "group relative flex items-start gap-2.5 rounded-lg border bg-card p-3 text-left shadow-sm transition-shadow",
          "hover:border-primary/30 hover:shadow has-[[data-task-handle]:focus-visible]:ring-2 has-[[data-task-handle]:focus-visible]:ring-ring",
          dragging && "opacity-40",
          overlay && "rotate-2 shadow-lg ring-1 ring-primary/30",
          className,
        )}
      >
        <TaskCheckbox checked={task.completed} onChange={(v) => onToggle?.(v)} className="z-10 mt-0.5" />
        <div
          {...handleProps}
          ref={handleRef}
          data-task-handle=""
          role="button"
          tabIndex={0}
          aria-label={`Abrir tarea: ${task.title}`}
          onClick={onOpen}
          onKeyDown={(e) => {
            // El sensor de teclado de dnd-kit usa Espacio; Enter abre la tarea.
            onKeyDown?.(e);
            if (e.key === "Enter" && e.target === e.currentTarget) onOpen?.();
          }}
          className={cn(
            "min-w-0 flex-1 cursor-grab touch-manipulation space-y-2 outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']",
            overlay && "cursor-grabbing",
          )}
        >
          <p className={cn("line-clamp-3 break-words text-sm font-medium", task.completed && "text-muted-foreground line-through")}>
            {task.title}
          </p>
          <TaskMeta task={task} subtasks={subtasks} comments={comments} />
        </div>
      </div>
    );
  }),
);
