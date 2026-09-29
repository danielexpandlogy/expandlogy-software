import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KanbanSquare, Plus, Search, User, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { displayName } from "@/lib/labels";
import type { BoardSummary } from "@/lib/database.types";
import { useBoards } from "../api/boards";
import { NewBoardDialog } from "../components/boards/NewBoardDialog";

const BoardsIndex = () => {
  const { isAdmin } = useAuth();
  const { data: boards = [], isLoading, error } = useBoards();
  const [creating, setCreating] = useState(false);
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

  const q = query.trim().toLowerCase();
  const matches = (b: BoardSummary) =>
    !q || b.name.toLowerCase().includes(q) || b.owner_name.toLowerCase().includes(q) || b.owner_email.includes(q);
  const mine = boards.filter((b) => b.is_member && matches(b));
  // Un admin ve además los tableros en los que no está (personales de otros, equipos ajenos).
  const others = isAdmin ? boards.filter((b) => !b.is_member && matches(b)) : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">To-do List</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? "Tus tableros y los de tu equipo." : "Los tableros que creaste y aquellos a los que te añadieron."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {boards.length > 6 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar tablero…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 bg-card pl-9 sm:w-56"
              />
            </div>
          )}
          <Button onClick={() => setCreating(true)} className="h-10">
            <Plus className="mr-1.5 size-4" /> Nuevo tablero
          </Button>
        </div>
      </div>

      <section aria-labelledby="my-boards" className="space-y-3">
        <h3 id="my-boards" className="text-sm font-semibold text-muted-foreground">
          Mis tableros
        </h3>
        {mine.length ? (
          <BoardGrid boards={mine} />
        ) : (
          <EmptyState
            title={q ? `Sin resultados para “${query}”` : "Aún no tienes tableros"}
            description={q ? "Prueba con otro nombre." : "Crea un tablero personal para organizar tus tareas."}
            action={
              !q && (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="mr-1.5 size-4" /> Nuevo tablero
                </Button>
              )
            }
          />
        )}
      </section>

      {others.length > 0 && (
        <section aria-labelledby="team-boards" className="space-y-3">
          <h3 id="team-boards" className="text-sm font-semibold text-muted-foreground">
            Otros tableros del equipo
          </h3>
          <BoardGrid boards={others} showOwner />
        </section>
      )}

      <NewBoardDialog open={creating} onOpenChange={setCreating} onCreated={(id) => navigate(`/todos/${id}`)} />
    </div>
  );
};

function BoardGrid({ boards, showOwner }: { boards: BoardSummary[]; showOwner?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {boards.map((b) => (
        <BoardCard key={b.id} board={b} showOwner={showOwner} />
      ))}
    </div>
  );
}

function BoardCard({ board, showOwner }: { board: BoardSummary; showOwner?: boolean }) {
  const total = board.pending_count + board.completed_count;
  const rate = total ? Math.round((board.completed_count / total) * 100) : 0;
  const shared = board.member_count > 1;
  const Icon = shared ? Users : User;
  const owner = board.owner_name || board.owner_email ? displayName(board.owner_name, board.owner_email) : null;
  return (
    <Link to={`/todos/${board.id}`} className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full shadow-none transition-colors group-hover:border-primary/40">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{board.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {shared ? `${board.member_count} personas` : board.is_member ? "Solo tú" : "1 persona"}
                {showOwner && owner && ` · ${owner}`}
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
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
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
