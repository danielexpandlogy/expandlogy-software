import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";
import { useCreateBoard } from "../../api/boards";
import { MemberPicker } from "./MemberPicker";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (boardId: string) => void;
}

/**
 * Cualquiera crea tableros y queda dentro. Un admin, además, puede elegir quién
 * más entra (opcional: puede crearlo estando solo y añadir personas después).
 */
export function NewBoardDialog({ open, onOpenChange, onCreated }: Props) {
  const { isAdmin, session } = useAuth();
  const me = session?.user.id ?? "";
  const createBoard = useCreateBoard();
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([me]);

  const reset = () => {
    setName("");
    setMembers([me]);
    createBoard.reset();
  };
  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const canSubmit = !!name.trim() && !createBoard.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createBoard.mutate(
      { name, memberIds: isAdmin ? members.filter((id) => id !== me) : [] },
      {
        onSuccess: (id) => {
          handleOpenChange(false);
          onCreated?.(id);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Nuevo tablero</DialogTitle>
            <DialogDescription>Empieza con las secciones Por hacer, En progreso y Listo.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="new-board-name">Nombre</Label>
            <Input
              id="new-board-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Ej. Equipo de ventas"
              autoFocus
            />
          </div>

          {isAdmin && (
            <div className="space-y-2">
              <Label>
                Personas del tablero <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <MemberPicker value={members} onChange={setMembers} locked={[me]} lockedLabel="tú" />
              <p className="text-xs text-muted-foreground">Tú siempre estás en el tablero. Podrás añadir o quitar personas después.</p>
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
            <Button type="submit" disabled={!canSubmit}>
              {createBoard.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Crear tablero
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
