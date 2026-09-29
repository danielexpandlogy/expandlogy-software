import { forwardRef, memo, type HTMLAttributes, type ReactNode } from "react";
import type { Task } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import type { TaskHandleProps } from "../board/TaskCard";
import { TaskCheckbox, TaskMeta } from "../shared/TaskMeta";

interface Props extends HTMLAttributes<HTMLDivElement> {
  task: Task;
  subtasks?: { done: number; total: number } | null;
  comments?: number;
  onToggle?: (completed: boolean) => void;
  onOpen?: () => void;
  handle?: TaskHandleProps;
  dragging?: boolean;
  overlay?: boolean;
  /** Controles antes del checkbox (p. ej. desplegar subtareas). */
  leading?: ReactNode;
  indent?: boolean;
}

/**
 * Fila de la vista lista. Igual que TaskCard: los controles (desplegar,
 * checkbox) son hermanos del área que abre/arrastra, nunca están anidados.
 */
export const TaskRow = memo(
  forwardRef<HTMLDivElement, Props>(function TaskRow(
    { task, subtasks, comments, onToggle, onOpen, handle, dragging, overlay, leading, indent, className, ...rest },
    ref,
  ) {
    const { ref: handleRef, onKeyDown, ...handleProps } = handle ?? {};
    return (
      <div
        {...rest}
        ref={ref}
        className={cn(
          "group relative flex min-h-11 items-start gap-3 bg-card px-3 py-2.5 text-left transition-colors sm:items-center",
          "hover:bg-muted/40 has-[[data-task-handle]:focus-visible]:z-10 has-[[data-task-handle]:focus-visible]:ring-2 has-[[data-task-handle]:focus-visible]:ring-inset has-[[data-task-handle]:focus-visible]:ring-ring",
          indent && "pl-12",
          dragging && "opacity-40",
          overlay && "rounded-lg shadow-lg ring-1 ring-primary/30",
          className,
        )}
      >
        {leading && <div className="relative z-20 flex shrink-0">{leading}</div>}
        <TaskCheckbox checked={task.completed} onChange={(v) => onToggle?.(v)} className="z-10 mt-0.5 sm:mt-0" />
        <div
          {...handleProps}
          ref={handleRef}
          data-task-handle=""
          role="button"
          tabIndex={0}
          aria-label={`Abrir tarea: ${task.title}`}
          onClick={onOpen}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (e.key === "Enter" && e.target === e.currentTarget) onOpen?.();
          }}
          className="flex min-w-0 flex-1 cursor-pointer touch-manipulation flex-col gap-1 outline-none after:absolute after:inset-0 after:content-[''] sm:flex-row sm:items-center sm:gap-4"
        >
          <p className={cn("min-w-0 flex-1 truncate text-sm", task.completed && "text-muted-foreground line-through")}>
            {task.title}
          </p>
          <TaskMeta task={task} subtasks={subtasks} comments={comments} className="shrink-0" />
        </div>
      </div>
    );
  }),
);
