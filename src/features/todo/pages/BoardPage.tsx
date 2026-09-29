import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Archive, ArrowLeft, Search, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { BoardNotFoundError, useBoard } from "../api/board";
import { useBoards } from "../api/boards";
import { useBoardRealtime } from "../api/realtime";
import { BoardHeader } from "../components/board/BoardHeader";
import { KanbanView } from "../components/board/KanbanView";
import { ListView } from "../components/list/ListView";
// El panel de detalle (comentarios, adjuntos, grabadora) se carga al abrir una tarea.
const TaskDetailPanel = lazy(() => import("../components/task/TaskDetailPanel"));
const NewTaskDialog = lazy(() => import("../components/task/NewTaskDialog").then((m) => ({ default: m.NewTaskDialog })));
import { filterTasks, type BoardData } from "../lib/tree";
import { useBoardView } from "../lib/use-board-view";
import { useLocalState } from "../lib/use-local-state";

const BoardPage = () => {
  const { boardId = "" } = useParams<{ boardId: string }>();
  const { data, isLoading, error } = useBoard(boardId);
  const { data: summaries } = useBoards();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [showCompleted, setShowCompleted] = useLocalState(`todo:showCompleted:${boardId}`, false);
  const [view, setView] = useBoardView(boardId);
  const [query, setQuery] = useState("");
  // Sección desde la que se abrió "Añadir tarea" (null = cerrado).
  const [newTaskIn, setNewTaskIn] = useState<string | null>(null);
  const realtime = useBoardRealtime(data ? boardId : undefined);
  // Las vistas reciben las tareas filtradas; el detalle, el tablero completo.
  const visibleData = useMemo(() => (data && query ? { ...data, tasks: filterTasks(data.tasks, query) } : data), [data, query]);
  // Conserva ?vista= al abrir y cerrar el detalle.
  const openTask = useCallback(
    (taskId: string) => navigate(`/todos/${boardId}/t/${taskId}${window.location.search}`),
    [navigate, boardId],
  );
  const closeTask = useCallback(() => navigate(`/todos/${boardId}${window.location.search}`), [navigate, boardId]);

  if (isLoading) return <BoardSkeleton />;
  if (error || !data) {
    return (
      <Notice
        title={error instanceof BoardNotFoundError ? "Tablero no encontrado" : "No se pudo cargar el tablero"}
        description={error instanceof BoardNotFoundError ? "No existe o no tienes acceso a él." : error?.message}
      />
    );
  }
  if (data.board.archived_at) {
    return <Notice icon={<Archive className="size-5 text-muted-foreground" />} title="Este tablero está archivado" />;
  }

  const summary = summaries?.find((b) => b.id === data.board.id);
  const owner = summary && summary.owner_id !== session?.user.id ? summary.owner_name || summary.owner_email : null;
  const people = summary?.member_count ?? 1;
  const subtitle = [
    owner ? `Creado por ${owner}` : null,
    people > 1 ? `${people} personas` : owner ? null : "Solo tú",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-5">
      <BoardHeader
        board={data.board}
        subtitle={subtitle}
        view={view}
        onViewChange={setView}
        showCompleted={showCompleted}
        onShowCompletedChange={setShowCompleted}
      >
        {realtime === "offline" && (
          <span role="status" className="flex items-center gap-1.5 rounded-md bg-warning/15 px-2 py-1 text-xs font-medium text-[hsl(28_90%_30%)]">
            <WifiOff className="size-3.5" /> Sin conexión, reintentando…
          </span>
        )}
        <div className="relative w-full md:w-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en el tablero…"
            aria-label="Buscar en el tablero"
            className="h-9 w-full bg-card pl-8 md:w-56"
          />
        </div>
      </BoardHeader>
      {query && visibleData && !visibleData.tasks.length && (
        <p className="text-sm text-muted-foreground">Ninguna tarea coincide con “{query}”.</p>
      )}
      {view === "kanban" ? (
        <KanbanView data={visibleData!} showCompleted={showCompleted} onOpenTask={openTask} onAddTask={setNewTaskIn} />
      ) : (
        <ListView data={visibleData!} showCompleted={showCompleted} onOpenTask={openTask} onAddTask={setNewTaskIn} />
      )}
      {newTaskIn !== null && (
        <Suspense fallback={null}>
          <NewTaskDialog
            data={data}
            open
            onOpenChange={(o) => !o && setNewTaskIn(null)}
            sectionId={newTaskIn}
          />
        </Suspense>
      )}
      <Routes>
        <Route path="t/:taskId" element={<TaskDetailRoute data={data} onNavigate={openTask} onClose={closeTask} />} />
      </Routes>
    </div>
  );
};

function TaskDetailRoute(props: { data: BoardData; onNavigate: (id: string) => void; onClose: () => void }) {
  const { taskId = "" } = useParams<{ taskId: string }>();
  return (
    <Suspense fallback={null}>
      <TaskDetailPanel key={taskId} taskId={taskId} {...props} />
    </Suspense>
  );
}

function BoardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-80 w-72 shrink-0 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function Notice({ title, description, icon }: { title: string; description?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      {icon && <span className="grid size-12 place-items-center rounded-full bg-muted">{icon}</span>}
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to="/todos">
          <ArrowLeft className="mr-1.5 size-4" /> Volver al To-do List
        </Link>
      </Button>
    </div>
  );
}

export default BoardPage;
