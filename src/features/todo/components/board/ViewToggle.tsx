import { Columns3, List } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { BoardView } from "../../lib/use-board-view";

export function ViewToggle({ view, onChange }: { view: BoardView; onChange: (v: BoardView) => void }) {
  return (
    <ToggleGroup
      type="single"
      value={view}
      // Radix permite "deseleccionar"; aquí siempre hay una vista activa.
      onValueChange={(v) => v && onChange(v as BoardView)}
      aria-label="Vista del tablero"
      className="rounded-lg border bg-card p-0.5"
    >
      <ToggleGroupItem value="kanban" size="sm" className="h-8 gap-1.5 px-2.5 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
        <Columns3 className="size-4" /> Kanban
      </ToggleGroupItem>
      <ToggleGroupItem value="lista" size="sm" className="h-8 gap-1.5 px-2.5 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
        <List className="size-4" /> Lista
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
