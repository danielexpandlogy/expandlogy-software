import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CalendarDays, Loader2, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TodoPriority } from "@/lib/database.types";
import { PRIORITY_LABEL } from "@/lib/labels";
import { useCreateTask } from "../../api/board";
import { byPosition, positionAtEnd, positionBetween } from "../../lib/ordering";
import type { BoardData } from "../../lib/tree";
import { ReminderPicker } from "./ReminderPicker";

interface Props {
  data: BoardData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sección desde la que se abrió ("Añadir tarea" de una columna). */
  sectionId?: string;
  /** "Crear y abrir": abre el detalle para seguir con comentarios y adjuntos. */
  onOpenTask?: (taskId: string) => void;
}

/**
 * Alta completa de una tarea: título, descripción, sección, prioridad, fecha
 * límite, recordatorio (Beta) y subtareas. Comentarios y adjuntos necesitan que
 * la tarea exista: para eso está "Crear y abrir".
 */
export function NewTaskDialog({ data, open, onOpenChange, sectionId, onOpenTask }: Props) {
  const createTask = useCreateTask(data.board.id);
  const sections = useMemo(() => [...data.sections].sort(byPosition), [data.sections]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [section, setSection] = useState(sectionId ?? sections[0]?.id ?? "");
  const [priority, setPriority] = useState<TodoPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [reminder, setReminder] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const subtaskInput = useRef<HTMLInputElement>(null);

  // Cada apertura empieza limpia, en la sección desde la que se abrió.
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setSection(sectionId ?? sections[0]?.id ?? "");
    setPriority("medium");
    setDueDate("");
    setReminder(null);
    setSubtasks([]);
    setSubtaskDraft("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sectionId]);

  const addSubtask = () => {
    const t = subtaskDraft.trim();
    if (!t) return;
    setSubtasks((prev) => [...prev, t]);
    setSubtaskDraft("");
    subtaskInput.current?.focus();
  };

  const canSubmit = !!title.trim() && !!section && !saving;

  const create = async (andOpen: boolean) => {
    if (!canSubmit) return;
    setSaving(true);
    const pending = subtaskDraft.trim() ? [...subtasks, subtaskDraft.trim()] : subtasks;
    const siblings = data.tasks.filter((t) => t.section_id === section && t.parent_id === null);
    const id = crypto.randomUUID();
    try {
      await createTask.mutateAsync({
        id,
        title: title.trim(),
        description: description.trim(),
        section_id: section,
        priority,
        due_date: dueDate || null,
        reminder_at: reminder,
        position: positionAtEnd(siblings),
      });
      let last: string | null = null;
      for (const sub of pending) {
        last = positionBetween(last, null);
        await createTask.mutateAsync({ id: crypto.randomUUID(), title: sub, parent_id: id, position: last });
      }
      onOpenChange(false);
      if (andOpen) onOpenTask?.(id);
    } catch {
      // useCreateTask ya muestra el error y deshace el cambio optimista.
    } finally {
      setSaving(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void create(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <form
          onSubmit={submit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void create(false);
            }
          }}
          className="space-y-5"
        >
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
            <DialogDescription>En {data.board.name}. Podrás añadir comentarios y adjuntos al abrirla.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="new-task-title">Título</Label>
            <Input
              id="new-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
              placeholder="Ej. Enviar propuesta a cliente"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-task-description">Descripción</Label>
            <Textarea
              id="new-task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={20000}
              placeholder="Opcional"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Sección</Label>
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger aria-label="Sección">
                  <SelectValue placeholder="Elige una sección" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TodoPriority)}>
                <SelectTrigger aria-label="Prioridad">
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-task-due">Fecha límite</Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="new-task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Recordatorio</Label>
              <div>
                <ReminderPicker value={reminder} onChange={setReminder} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-task-subtask">Subtareas</Label>
            {subtasks.length > 0 && (
              <ul className="divide-y rounded-lg border" aria-label="Subtareas de la nueva tarea">
                {subtasks.map((s, i) => (
                  <li key={`${i}-${s}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{s}</span>
                    <button
                      type="button"
                      onClick={() => setSubtasks((prev) => prev.filter((_, j) => j !== i))}
                      className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Quitar subtarea ${s}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                ref={subtaskInput}
                id="new-task-subtask"
                value={subtaskDraft}
                onChange={(e) => setSubtaskDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter aquí añade la subtarea, no envía el formulario.
                  if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
                maxLength={500}
                placeholder="Nombre de la subtarea y Enter"
              />
              <Button type="button" variant="outline" size="icon" onClick={addSubtask} disabled={!subtaskDraft.trim()} aria-label="Añadir subtarea">
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            {onOpenTask && (
              <Button type="button" variant="secondary" disabled={!canSubmit} onClick={() => void create(true)}>
                Crear y abrir
              </Button>
            )}
            <Button type="submit" disabled={!canSubmit}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Crear tarea
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
