import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, MoreHorizontal, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useAuth } from "@/contexts/AuthContext";
import type { Board } from "@/lib/database.types";
import { useUpdateBoard } from "../../api/boards";
import { MembersDialog } from "../boards/MembersDialog";

interface Props {
  board: Board;
  subtitle?: string;
  /** Controles a la derecha (cambio de vista, mostrar completadas…). */
  children?: ReactNode;
}

export function BoardHeader({ board, subtitle, children }: Props) {
  const { isAdmin, session } = useAuth();
  // Renombrar/archivar: quien lo creó o un admin. Personas: sólo un admin.
  const canManage = isAdmin || board.owner_id === session?.user.id;
  const [managingMembers, setManagingMembers] = useState(false);
  const updateBoard = useUpdateBoard();
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(board.name);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const renameDone = useRef(false);
  const startRename = () => {
    renameDone.current = false;
    setName(board.name);
    setRenaming(true);
  };
  // Enter envía el form y luego el blur del input desmontado: sólo una vez.
  const submitRename = (e?: FormEvent) => {
    e?.preventDefault();
    if (renameDone.current) return;
    renameDone.current = true;
    const next = name.trim();
    setRenaming(false);
    if (!next || next === board.name) return setName(board.name);
    updateBoard.mutate({ id: board.id, name: next });
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        {renaming ? (
          <form onSubmit={submitRename} className="w-full max-w-sm">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => submitRename()}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  renameDone.current = true;
                  setName(board.name);
                  setRenaming(false);
                }
              }}
              maxLength={120}
              autoFocus
              aria-label="Nombre del tablero"
              className="h-9 text-lg font-semibold"
            />
          </form>
        ) : (
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-semibold tracking-tight">{board.name}</h2>
            {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        )}
        {canManage && !renaming && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Opciones del tablero</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={startRename}>
                <Pencil className="mr-2 size-4" /> Renombrar
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onSelect={() => setManagingMembers(true)}>
                  <Users className="mr-2 size-4" /> Personas del tablero
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setConfirmArchive(true)} className="text-destructive focus:text-destructive">
                <Archive className="mr-2 size-4" /> Archivar tablero
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}

      {isAdmin && (
        <MembersDialog board={board} open={managingMembers} onOpenChange={setManagingMembers} />
      )}

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar “{board.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              El tablero deja de aparecer en el To-do List y en el menú de sus personas. No se borra ninguna tarea.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                updateBoard.mutate(
                  { id: board.id, archived_at: new Date().toISOString() },
                  { onSuccess: () => navigate("/todos", { replace: true }) },
                )
              }
            >
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
