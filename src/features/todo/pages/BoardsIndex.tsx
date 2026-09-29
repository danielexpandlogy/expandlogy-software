import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { KanbanSquare, Search, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { displayName, initials } from "@/lib/labels";
import type { BoardSummary } from "@/lib/database.types";
import { useBoards } from "../api/boards";
import { AddUserToTodoDialog } from "../components/boards/AddUserToTodoDialog";

const BoardsIndex = () => {
  const { isAdmin, session } = useAuth();
  const { data: boards = [], isLoading, error } = useBoards();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    );
  }

  if (error) return <p className="text-sm text-destructive">No se pudieron cargar los tableros: {error.message}</p>;

  // Un usuario con un solo tablero va directo a él.
  if (!isAdmin && boards.length === 1) return <Navigate to={`/todos/${boards[0].id}`} replace />;

  if (!isAdmin && boards.length === 0) {
    return (
      <EmptyState
        title="Aún no tienes un tablero"
        description="Pídele a un administrador que te añada al To-do List."
      />
    );
  }

  const q = query.trim().toLowerCase();
  const visible = boards.filter(
    (b) => !q || b.name.toLowerCase().includes(q) || b.owner_name.toLowerCase().includes(q) || b.owner_email.includes(q),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">To-do List</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? "Tableros de tu equipo." : "Tus tableros."}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-col gap-2 sm:flex-row">
            {boards.length > 3 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar persona…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-10 bg-card pl-9 sm:w-56"
                />
              </div>
            )}
            <Button onClick={() => setAdding(true)} className="h-10">
              <UserPlus className="mr-1.5 size-4" /> Añadir usuario
            </Button>
          </div>
        )}
      </div>

      {boards.length === 0 ? (
        <EmptyState
          title="Todavía no hay tableros"
          description="Añade a un usuario al To-do List para crearle su tablero."
          action={
            <Button onClick={() => setAdding(true)}>
              <UserPlus className="mr-1.5 size-4" /> Añadir usuario
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((b) => (
            <BoardCard key={b.id} board={b} isMine={b.owner_id === session?.user.id} />
          ))}
          {!visible.length && <p className="text-sm text-muted-foreground">Sin resultados para “{query}”.</p>}
        </div>
      )}

      {isAdmin && (
        <AddUserToTodoDialog
          open={adding}
          onOpenChange={setAdding}
          boards={boards}
          onCreated={(id) => navigate(`/todos/${id}`)}
        />
      )}
    </div>
  );
};

function BoardCard({ board, isMine }: { board: BoardSummary; isMine: boolean }) {
  const total = board.pending_count + board.completed_count;
  const rate = total ? Math.round((board.completed_count / total) * 100) : 0;
  return (
    <Link to={`/todos/${board.id}`} className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full shadow-none transition-colors group-hover:border-primary/40">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {initials(board.owner_name, board.owner_email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold">{board.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {displayName(board.owner_name, board.owner_email)}
                {isMine && " · Tú"}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                <span className="font-medium tabular-nums text-foreground">{board.pending_count}</span> pendientes
              </span>
              <span className="tabular-nums">{rate}% completado</span>
            </div>
            <Progress value={rate} className="h-1.5" aria-label={`${rate}% completado`} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-20 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted">
        <KanbanSquare className="size-5 text-muted-foreground" />
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export default BoardsIndex;
