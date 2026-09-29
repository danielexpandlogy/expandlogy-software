import { useState, type FormEvent } from "react";
import { Loader2, User, Users } from "lucide-react";
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
import type { BoardKind } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { useCreateBoard } from "../../api/boards";
import { MemberPicker } from "./MemberPicker";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (boardId: string) => void;
}

/** Tablero personal (cualquiera) o de equipo con varias personas (sólo admins). */
export function NewBoardDialog({ open, onOpenChange, onCreated }: Props) {
  const { isAdmin, session } = useAuth();
  const me = session?.user.id ?? "";
  const createBoard = useCreateBoard();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<BoardKind>("personal");
  const [members, setMembers] = useState<string[]>([]);

  const reset = () => {
    setName("");
    setKind("personal");
    setMembers([]);
    createBoard.reset();
  };
  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const others = members.filter((id) => id !== me);
  const canSubmit = !!name.trim() && (kind === "personal" || others.length > 0) && !createBoard.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createBoard.mutate(
      { name, kind, memberIds: kind === "team" ? others : [] },
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
              placeholder={kind === "team" ? "Ej. Equipo de ventas" : "Ej. Mis pendientes"}
              autoFocus
            />
          </div>

          {isAdmin && (
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div role="radiogroup" aria-label="Tipo de tablero" className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["personal", "Personal", "Sólo para ti", User],
                    ["team", "De equipo", "Asigna personas", Users],
                  ] as const
                ).map(([value, label, hint, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={kind === value}
                    onClick={() => setKind(value)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
                      kind === value ? "border-primary bg-accent" : "hover:bg-muted/60",
                    )}
                  >
                    <Icon className={cn("mt-0.5 size-4", kind === value ? "text-primary" : "text-muted-foreground")} />
                    <span>
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="block text-xs text-muted-foreground">{hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isAdmin && kind === "team" && (
            <div className="space-y-2">
              <Label>Personas del tablero</Label>
              <MemberPicker value={members} onChange={setMembers} />
              <p className="text-xs text-muted-foreground">Tú también quedas en el tablero. Podrás cambiar las personas después.</p>
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
