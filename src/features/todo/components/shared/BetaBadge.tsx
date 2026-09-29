import { cn } from "@/lib/utils";

/** Marca para funciones experimentales (hoy: recordatorios sin notificaciones). */
export function BetaBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded bg-accent px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-accent-foreground",
        className,
      )}
    >
      Beta
    </span>
  );
}
