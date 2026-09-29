import { format, isSameYear } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, CalendarDays, ListChecks, MessageSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Task } from "@/lib/database.types";
import { PRIORITY_CLASS, PRIORITY_LABEL } from "@/lib/labels";
import { isOverdue, parseDueDate } from "@/lib/todo-stats";
import { cn } from "@/lib/utils";

export function PriorityChip({ priority }: { priority: Task["priority"] }) {
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium", PRIORITY_CLASS[priority])}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

const shortDate = (d: Date) => format(d, isSameYear(d, new Date()) ? "d MMM" : "d MMM yyyy", { locale: es });

export function DueDateLabel({ task }: { task: Pick<Task, "due_date" | "completed"> }) {
  if (!task.due_date) return null;
  const overdue = isOverdue({ completed: task.completed, due_date: task.due_date, completed_at: null, priority: "medium" });
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", overdue && "font-medium text-destructive")}>
      <CalendarDays className="size-3.5" />
      {shortDate(parseDueDate(task.due_date))}
      {overdue && <span className="sr-only">, vencida</span>}
    </span>
  );
}

export function ReminderLabel({ reminderAt }: { reminderAt: string | null }) {
  if (!reminderAt) return null;
  const d = new Date(reminderAt);
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Recordatorio (Beta)">
      <Bell className="size-3.5" />
      {shortDate(d)} {format(d, "HH:mm")}
    </span>
  );
}

interface MetaProps {
  task: Task;
  subtasks?: { done: number; total: number } | null;
  comments?: number;
  className?: string;
}

/** Fila de chips bajo el título: prioridad, fecha, recordatorio, subtareas, comentarios. */
export function TaskMeta({ task, subtasks, comments, className }: MetaProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-1", className)}>
      <PriorityChip priority={task.priority} />
      <DueDateLabel task={task} />
      <ReminderLabel reminderAt={task.reminder_at} />
      {subtasks && (
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground",
            subtasks.done === subtasks.total && "text-success",
          )}
          aria-label={`${subtasks.done} de ${subtasks.total} subtareas completadas`}
        >
          <ListChecks className="size-3.5" />
          {subtasks.done}/{subtasks.total}
        </span>
      )}
      {!!comments && (
        <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground" aria-label={`${comments} comentarios`}>
          <MessageSquare className="size-3.5" />
          {comments}
        </span>
      )}
    </div>
  );
}

export function TaskCheckbox({
  checked,
  onChange,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(v) => onChange(v === true)}
      // El checkbox vive dentro de tarjetas arrastrables y clicables.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      // Se ve de 20 px; el área táctil es de 36 px (pseudo-elemento). No más: con
      // 44 px tapaba el asa de arrastre y el chevron vecinos (a 8 px).
      className={cn("relative size-5 shrink-0 rounded-full after:absolute after:-inset-2 after:content-['']", className)}
      aria-label={checked ? "Marcar como pendiente" : "Marcar como completada"}
    />
  );
}
