import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, Columns3, List, MoreHorizontal, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
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
import type { BoardView } from "../../lib/use-board-view";
import { MembersDialog } from "../boards/MembersDialog";

interface Props {
  board: Board;
  subtitle?: string;
  view: BoardView;
  onViewChange: (view: BoardView) => void;
  showCompleted: boolean;
  onShowCompletedChange: (show: boolean) => void;
  /** Controles junto al menú (búsqueda, estado de conexión). */
  children?: ReactNode;
}

/**
 * Nombre del tablero a la izquierda; a la derecha la búsqueda y un único menú
 * "⋯" con la vista (kanban/lista), "Mostrar completadas" y, para quien puede
 * gestionarlo, renombrar, personas y archivar.
 */
export function BoardHeader({ board, subtitle, view, onViewChange, showCompleted, onShowCompletedChange, children }: Props) {
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
      <div className="order-1 min-w-0 flex-1">
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
          <>
            <h2 className="truncate text-2xl font-semibold tracking-tight">{board.name}</h2>
            {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
          </>
        )}
      </div>

      {/* En móvil los controles bajan a su propia fila a lo ancho; el menú queda junto al título. */}
      {children && (
        <div className="order-3 flex w-full flex-wrap items-center gap-2 md:order-2 md:w-auto">{children}</div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="order-2 size-9 shrink-0 bg-card md:order-3">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Opciones del tablero</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Vista</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={view} onValueChange={(v) => onViewChange(v as BoardView)}>
            <DropdownMenuRadioItem value="kanban">
              <Columns3 className="mr-2 size-4" /> Kanban
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="lista">
              <List className="mr-2 size-4" /> Lista
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={showCompleted}
            onCheckedChange={(v) => onShowCompletedChange(v === true)}
            // No cerrar: se ve el efecto al instante detrás del menú.
            onSelect={(e) => e.preventDefault()}
          >
            Mostrar completadas
          </DropdownMenuCheckboxItem>
          {canManage && (
            <>
              <DropdownMenuSeparator />
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
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
