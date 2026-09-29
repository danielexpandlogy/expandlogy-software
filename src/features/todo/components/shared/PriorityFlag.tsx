import { Flag } from "lucide-react";
import { SelectItem } from "@/components/ui/select";
import type { TodoPriority } from "@/lib/database.types";
import { PRIORITIES, PRIORITY_FLAG, PRIORITY_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** Bandera de color + etiqueta ("Alta", "Media", "Baja"). */
export function PriorityFlag({ priority, className, iconOnly }: { priority: TodoPriority; className?: string; iconOnly?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)} title={`Prioridad ${PRIORITY_LABEL[priority].toLowerCase()}`}>
      <Flag className={cn("size-3.5 shrink-0 fill-current", PRIORITY_FLAG[priority])} aria-hidden />
      <span className={cn(iconOnly && "sr-only")}>{PRIORITY_LABEL[priority]}</span>
    </span>
  );
}

/** Opciones de un <Select> de prioridad, con su bandera. */
export function PrioritySelectItems() {
  return (
    <>
      {PRIORITIES.map((p) => (
        <SelectItem key={p} value={p}>
          <span className="flex items-center gap-2">
            <Flag className={cn("size-4 fill-current", PRIORITY_FLAG[p])} aria-hidden />
            {PRIORITY_LABEL[p]}
          </span>
        </SelectItem>
      ))}
    </>
  );
}
