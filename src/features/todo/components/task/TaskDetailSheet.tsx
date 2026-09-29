import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, CalendarDays, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import type { Database, Task, TodoPriority } from "@/lib/database.types";
import { displayName, PRIORITY_LABEL } from "@/lib/labels";
import { useDeleteTask, useUpdateTask } from "../../api/board";
import { useBoardPeople } from "../../api/people";
import { uploadsInFlight } from "../../lib/media";
import { byPosition, positionAtEnd } from "../../lib/ordering";
import { subtasksByParent, type BoardData } from "../../lib/tree";
import { TaskCheckbox } from "../shared/TaskMeta";
import { DescriptionEditor, EditableTitle } from "./EditableFields";
import { ReminderPicker } from "./ReminderPicker";
import { SubtaskList } from "./SubtaskList";

interface Props {
  data: BoardData;
  taskId: string;
  /** Abre otra tarea (subtarea o padre) en el mismo panel. */
  onNavigate: (taskId: string) => void;
  onClose: () => void;
  /** Hueco para los comentarios (Sprint 5). */
  footer?: (task: Task) => ReactNode;
}

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

const isEditable = (el: Element | null) =>
  !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);

export function TaskDetailSheet({ data, taskId, onNavigate, onClose, footer }: Props) {
  const boardId = data.board.id;
  const task = data.tasks.find((t) => t.id === taskId) ?? null;
  const parent = task?.parent_id ? (data.tasks.find((t) => t.id === task.parent_id) ?? null) : null;
  const subtasks = useMemo(() => (task ? (subtasksByParent(data.tasks).get(task.id) ?? []) : []), [data.tasks, task]);
  const sections = useMemo(() => [...data.sections].sort(byPosition), [data.sections]);
  const updateTask = useUpdateTask(boardId);
  const deleteTask = useDeleteTask(boardId);
  const { data: people } = useBoardPeople(boardId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deletingRef = useRef(false);

  // Borrada por otra persona (o en otra pestaña): se avisa y se cierra.
  useEffect(() => {
    if (!task) {
      if (!deletingRef.current) toast("Esta tarea fue eliminada");
      onClose();
    }
  }, [task, onClose]);

  if (!task) return null;

  const update = (changes: TaskUpdate) => updateTask.mutate({ id: task.id, ...changes });

  const toggleCompleted = (completed: boolean) => {
    update({ completed });
    const pending = subtasks.filter((s) => !s.completed).length;
    if (completed && pending) {
      toast(`Quedan ${pending} ${pending === 1 ? "subtarea pendiente" : "subtareas pendientes"}`);
    }
  };

  const moveToSection = (sectionId: string) => {
    if (sectionId === task.section_id) return;
    const siblings = data.tasks.filter((t) => t.section_id === sectionId && t.parent_id === null);
    updateTask.mutate({ id: task.id, section_id: sectionId, position: positionAtEnd(siblings) });
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/todos/${boardId}/t/${task.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      toast(url);
    }
  };

  const creator = task.created_by ? people?.get(task.created_by) : null;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (open) return;
        if (uploadsInFlight() > 0 && !window.confirm("Hay archivos subiéndose. ¿Salir de todos modos?")) return;
        onClose();
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 focus-visible:outline-none sm:max-w-[560px]"
        // Por defecto Radix enfoca el primer control (el selector de sección) y
        // en móvil abriría teclados; se enfoca el panel y Tab recorre desde ahí.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.target as HTMLElement | null)?.focus?.();
        }}
        // Esc dentro de un campo sólo sale del campo; no cierra el panel.
        onEscapeKeyDown={(e) => {
          if (isEditable(document.activeElement)) {
            e.preventDefault();
            (document.activeElement as HTMLElement).blur();
          }
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isEditable(document.activeElement)) {
            e.preventDefault();
            toggleCompleted(!task.completed);
          }
        }}
      >
        <div className="flex items-center gap-1 border-b px-4 py-3 pr-12">
          {parent ? (
            <Button variant="ghost" size="sm" className="-ml-2 h-8 min-w-0 gap-1.5 text-muted-foreground" onClick={() => onNavigate(parent.id)}>
              <ArrowLeft className="size-4 shrink-0" />
              <span className="truncate">{parent.title}</span>
            </Button>
          ) : (
            <Select value={task.section_id ?? undefined} onValueChange={moveToSection}>
              <SelectTrigger className="h-8 w-auto gap-1.5 border-none px-2 text-sm text-muted-foreground shadow-none" aria-label="Sección">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="ml-auto flex items-center">
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={copyLink} aria-label="Copiar enlace">
              <Link2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              aria-label={parent ? "Eliminar subtarea" : "Eliminar tarea"}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-6 px-5 py-5">
          <div className="flex items-start gap-3">
            <TaskCheckbox checked={task.completed} onChange={toggleCompleted} className="mt-1.5" />
            <div className="min-w-0 flex-1">
              <SheetTitle className="sr-only">{task.title}</SheetTitle>
              <SheetDescription className="sr-only">{parent ? "Detalle de la subtarea" : "Detalle de la tarea"}</SheetDescription>
              <EditableTitle value={task.title} completed={task.completed} onSave={(title) => update({ title })} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={task.priority} onValueChange={(v) => update({ priority: v as TodoPriority })}>
              <SelectTrigger className="h-8 w-auto gap-1.5 text-sm" aria-label="Prioridad">
                <span className="text-muted-foreground">Prioridad:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["high", "medium", "low"] as TodoPriority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex h-8 items-center gap-1.5 rounded-md border px-2 text-sm">
              <CalendarDays className="size-3.5 text-muted-foreground" />
              <span className="sr-only">Fecha límite</span>
              <Input
                type="date"
                value={task.due_date ?? ""}
                onChange={(e) => update({ due_date: e.target.value || null })}
                className="h-7 w-[8.5rem] border-none p-0 text-sm shadow-none focus-visible:ring-0"
                aria-label="Fecha límite"
              />
            </label>
            <ReminderPicker value={task.reminder_at} onChange={(reminder_at) => update({ reminder_at })} />
          </div>

          <DescriptionEditor
            key={task.id}
            value={task.description}
            onSave={(description) => updateTask.mutateAsync({ id: task.id, description })}
          />

          {/* Un solo nivel: una subtarea no puede tener subtareas. */}
          {!parent && <SubtaskList parent={task} subtasks={subtasks} onOpen={onNavigate} />}

          {footer?.(task)}
        </div>

        <p className="border-t px-5 py-3 text-xs text-muted-foreground">
          Creada {creator ? `por ${displayName(creator.full_name, creator.email)} ` : ""}el{" "}
          {format(new Date(task.created_at), "d 'de' MMMM yyyy", { locale: es })}
          {parent && (
            <>
              {" · "}
              Subtarea de{" "}
              <Link to={`/todos/${boardId}/t/${parent.id}`} className="underline underline-offset-2">
                {parent.title}
              </Link>
            </>
          )}
        </p>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar “{task.title}”?</AlertDialogTitle>
              <AlertDialogDescription>
                {parent
                  ? "Se eliminarán también sus comentarios."
                  : `Se eliminarán también sus ${subtasks.length ? `${subtasks.length} subtareas y ` : ""}comentarios.`}{" "}
                Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  deletingRef.current = true;
                  if (parent) onNavigate(parent.id);
                  else onClose();
                  deleteTask.mutate(task.id);
                }}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
