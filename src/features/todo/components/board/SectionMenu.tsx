import { useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Section } from "@/lib/database.types";
import { useDeleteSection } from "../../api/board";

interface Props {
  section: Section;
  /** Todas las tareas de la sección, también las completadas ocultas. */
  taskCount: number;
  onRename: () => void;
}

export function SectionMenu({ section, taskCount, onRename }: Props) {
  const deleteSection = useDeleteSection(section.board_id);
  const [confirming, setConfirming] = useState(false);

  const remove = () => (taskCount ? setConfirming(true) : deleteSection.mutate(section.id));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Opciones de la sección {section.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onRename}>
            <Pencil className="mr-2 size-4" /> Renombrar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={remove} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 size-4" /> Eliminar sección
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la sección “{section.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán también sus {taskCount} {taskCount === 1 ? "tarea" : "tareas"}, con sus subtareas y
              comentarios. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteSection.mutate(section.id)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Nombre de sección editable en línea. */
export function SectionNameInput({ section, onDone }: { section: Section; onDone: (name: string | null) => void }) {
  const [name, setName] = useState(section.name);
  // Enter/Escape desmontan el input y el navegador dispara blur: sólo una vez.
  const done = useRef(false);
  const finish = (value: string | null = name) => {
    if (done.current) return;
    done.current = true;
    const next = value?.trim();
    onDone(next && next !== section.name ? next : null);
  };
  return (
    <input
      autoFocus
      value={name}
      maxLength={120}
      aria-label="Nombre de la sección"
      onChange={(e) => setName(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish();
        if (e.key === "Escape") finish(null);
      }}
      onBlur={() => finish()}
      className="h-7 w-full min-w-0 rounded-md border bg-card px-2 text-sm font-semibold outline-none ring-ring focus-visible:ring-2"
    />
  );
}
