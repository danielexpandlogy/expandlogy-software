import { useMemo, useState, type FormEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfiles } from "@/hooks/use-users";
import { displayName, initials, ROLE_LABEL } from "@/lib/labels";
import type { BoardSummary } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { useCreateBoardForUser } from "../../api/boards";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boards: BoardSummary[];
  onCreated?: (boardId: string) => void;
}

export function AddUserToTodoDialog({ open, onOpenChange, boards, onCreated }: Props) {
  const { data: profiles = [], isLoading } = useProfiles();
  const createBoard = useCreateBoardForUser();
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");

  // Sólo quienes aún no tienen tablero activo.
  const candidates = useMemo(() => {
    const withBoard = new Set(boards.map((b) => b.owner_id));
    return profiles.filter((p) => !withBoard.has(p.id));
  }, [profiles, boards]);

  const selected = candidates.find((p) => p.id === userId) ?? null;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setUserId(null);
      setName("");
      createBoard.reset();
    }
    onOpenChange(next);
  };

  const select = (id: string) => {
    const p = candidates.find((c) => c.id === id);
    setUserId(id);
    if (p) setName(`Tablero de ${displayName(p.full_name, p.email).split(" ")[0]}`);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !name.trim()) return;
    createBoard.mutate(
      { userId: selected.id, name },
      {
        onSuccess: (boardId) => {
          toast.success(`${displayName(selected.full_name, selected.email)} ya tiene su tablero`);
          handleOpenChange(false);
          onCreated?.(boardId);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Añadir usuario al To-do List</DialogTitle>
            <DialogDescription>
              Se le creará un tablero con las secciones Por hacer, En progreso y Listo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Usuario</Label>
            <Command className="rounded-lg border">
              <CommandInput placeholder="Buscar por nombre o email…" />
              <CommandList className="max-h-56">
                <CommandEmpty>
                  {isLoading ? "Cargando…" : candidates.length ? "Sin resultados." : "Todos los usuarios ya tienen tablero."}
                </CommandEmpty>
                <CommandGroup>
                  {candidates.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`${p.full_name} ${p.email}`}
                      onSelect={() => select(p.id)}
                      className="gap-3"
                    >
                      <Avatar className="size-7">
                        <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                          {initials(p.full_name, p.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{displayName(p.full_name, p.email)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.email} · {ROLE_LABEL[p.role]}
                        </p>
                      </div>
                      <Check className={cn("size-4 text-primary", userId === p.id ? "opacity-100" : "opacity-0")} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>

          {selected && (
            <div className="space-y-2">
              <Label htmlFor="board-name">Nombre del tablero</Label>
              <Input id="board-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
            </div>
          )}

          {createBoard.error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {createBoard.error.message}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!selected || !name.trim() || createBoard.isPending}>
              {createBoard.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Crear tablero
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
