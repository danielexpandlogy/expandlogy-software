import { Link } from "react-router-dom";
import type { Task } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { TaskCheckbox, TaskMeta } from "./TaskMeta";

/** Fila compacta con enlace al detalle (Home y listas resumidas). */
export function CompactTaskItem({ task, onToggle }: { task: Task; onToggle: (completed: boolean) => void }) {
  return (
    <li className="flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/50">
      <TaskCheckbox checked={task.completed} onChange={onToggle} className="mt-0.5" />
      <Link to={`/todos/${task.board_id}/t/${task.id}`} className="min-w-0 flex-1 focus-visible:outline-none focus-visible:underline">
        <p className={cn("break-words text-sm font-medium", task.completed && "text-muted-foreground line-through")}>
          {task.title}
        </p>
        <TaskMeta task={task} className="mt-1.5" />
      </Link>
    </li>
  );
}
