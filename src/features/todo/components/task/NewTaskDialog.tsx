import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
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
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TodoPriority } from "@/lib/database.types";
import { useCreateTask } from "../../api/board";
import { positionAtEnd } from "../../lib/ordering";
import type { BoardData } from "../../lib/tree";
import { PrioritySelectItems } from "../shared/PriorityFlag";
import { ReminderPicker } from "./ReminderPicker";

interface Props {
  data: BoardData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sección desde la que se abrió "Añadir tarea": la tarea va al final de ella. */
  sectionId: string;
}

/**
 * Alta de una tarea desde su sección: título, descripción, prioridad, fecha
 * límite y recordatorio (Beta). Subtareas, comentarios y adjuntos se añaden en
 * el detalle, al abrir la tarea ya creada. Un solo botón: "Crear tarea".
 */
export function NewTaskDialog({ data, open, onOpenChange, sectionId }: Props) {
  const createTask = useCreateTask(data.board.id);
  const section = data.sections.find((s) => s.id === sectionId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [reminder, setReminder] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Cada apertura empieza limpia.
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setReminder(null);
  }, [open, sectionId]);

  const canSubmit = !!title.trim() && !!section && !saving;

  const create = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const siblings = data.tasks.filter((t) => t.section_id === sectionId && t.parent_id === null);
    const id = crypto.randomUUID();
    try {
      await createTask.mutateAsync({
        id,
        title: title.trim(),
        description: description.trim(),
        section_id: sectionId,
        priority,
        due_date: dueDate || null,
        reminder_at: reminder,
        position: positionAtEnd(siblings),
      });
      onOpenChange(false);
    } catch {
      // useCreateTask ya muestra el error y deshace el cambio optimista.
    } finally {
      setSaving(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void create();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <form
          onSubmit={submit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void create();
            }
          }}
          className="space-y-5"
        >
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
            <DialogDescription>
              Se añadirá al final de <span className="font-medium text-foreground">{section?.name}</span>. Las subtareas,
              comentarios y adjuntos se agregan en la tarea, una vez creada.
            </DialogDescription>
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
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TodoPriority)}>
                <SelectTrigger aria-label="Prioridad">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <PrioritySelectItems />
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
            <div className="space-y-2 sm:col-span-2">
              <Label>Recordatorio</Label>
              <div>
                <ReminderPicker value={reminder} onChange={setReminder} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
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
