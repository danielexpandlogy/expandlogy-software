import { useMemo, useState, type FormEvent } from "react";
import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { es } from "date-fns/locale";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, Plus, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { boardQuery, useCreateTask, useUpdateTask } from "@/features/todo/api/board";
import { useMyBoards } from "@/features/todo/api/boards";
import { useLocalState } from "@/features/todo/lib/use-local-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Task } from "@/lib/database.types";
import { CompactTaskItem } from "@/features/todo/components/shared/CompactTaskItem";
import { byPosition, positionAtEnd } from "@/features/todo/lib/ordering";
import { topLevel } from "@/features/todo/lib/tree";
import { displayName, PRIORITY_BG } from "@/lib/labels";
import { PriorityFlag } from "@/features/todo/components/shared/PriorityFlag";
import { completedPerDay, todoStats, upcoming } from "@/lib/todo-stats";
import type { TodoPriority } from "@/lib/database.types";
import { cn } from "@/lib/utils";

function greeting(hour: number) {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

const Home = () => {
  const { profile, session } = useAuth();
  // Los KPIs suman los tableros en los que está la persona (personales y de equipo).
  const { data: myBoards, isLoading: boardsLoading } = useMyBoards();
  const boardQueries = useQueries({ queries: myBoards.map((b) => boardQuery(b.id)) });
  const isLoading = boardsLoading || boardQueries.some((q) => q.isLoading);
  const allTasks = boardQueries.flatMap((q) => q.data?.tasks ?? []);
  const tasksKey = boardQueries.map((q) => q.dataUpdatedAt).join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const todos = useMemo(() => topLevel(allTasks), [tasksKey]);
  const [quickTitle, setQuickTitle] = useState("");
  // Tablero destino del "Añadir tarea rápida" (se recuerda).
  const [quickBoardPref, setQuickBoard] = useLocalState<string | null>("todo:quickBoard", null);
  const quickBoardId = myBoards.some((b) => b.id === quickBoardPref) ? quickBoardPref! : (myBoards[0]?.id ?? "");
  const quickBoard = boardQueries[myBoards.findIndex((b) => b.id === quickBoardId)]?.data;
  const createTask = useCreateTask(quickBoardId);

  const now = new Date();
  const name = displayName(profile?.full_name ?? "", profile?.email ?? session?.user.email ?? "").split(" ")[0];
  const stats = useMemo(() => todoStats(todos), [todos]);
  const perDay = useMemo(() => completedPerDay(todos), [todos]);
  const next = useMemo(() => upcoming(todos), [todos]);
  const byPriority = useMemo(() => {
    const pending = todos.filter((t) => !t.completed);
    return (["high", "medium", "low"] as TodoPriority[]).map((p) => ({
      priority: p,
      count: pending.filter((t) => t.priority === p).length,
      share: pending.length ? pending.filter((t) => t.priority === p).length / pending.length : 0,
    }));
  }, [todos]);
  const weekTotal = perDay.reduce((sum, d) => sum + d.count, 0);

  const handleQuickAdd = (e: FormEvent) => {
    e.preventDefault();
    const title = quickTitle.trim();
    const firstSection = [...(quickBoard?.sections ?? [])].sort(byPosition)[0];
    if (!title) return;
    if (!firstSection) {
      toast.error("Ese tablero no tiene secciones", { description: "Crea una sección en el tablero para añadir tareas." });
      return;
    }
    const siblings = (quickBoard?.tasks ?? []).filter((t) => t.section_id === firstSection.id && t.parent_id === null);
    createTask.mutate({ id: crypto.randomUUID(), title, section_id: firstSection.id, position: positionAtEnd(siblings) });
    setQuickTitle("");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {format(now, "EEEE, d 'de' MMMM", { locale: es })}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            {greeting(now.getHours())}, {name}
          </h2>
        </div>
        <form onSubmit={handleQuickAdd} className="flex w-full flex-wrap gap-2 sm:flex-nowrap md:max-w-md">
          {myBoards.length > 1 && (
            <Select value={quickBoardId} onValueChange={setQuickBoard}>
              <SelectTrigger className="h-10 w-full shrink-0 bg-card sm:w-40" aria-label="Tablero de la tarea rápida">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {myBoards.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            placeholder="Añadir tarea rápida…"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            maxLength={200}
            className="h-10 min-w-0 flex-1 bg-card"
            disabled={!myBoards.length}
          />
          <Button type="submit" size="icon" className="size-10 shrink-0" disabled={!quickTitle.trim() || !quickBoard}>
            <Plus className="size-4" />
            <span className="sr-only">Añadir</span>
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Pendientes" value={stats.pending} icon={CircleDashed} loading={isLoading} />
        <StatTile label="Completadas" value={stats.completed} icon={CheckCircle2} loading={isLoading} tone="success" />
        <StatTile label="Vencidas" value={stats.overdue} icon={AlertTriangle} loading={isLoading} tone={stats.overdue ? "danger" : undefined} />
        <Card className="shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              Progreso
              <TrendingUp className="size-4" />
            </div>
            {isLoading ? (
              <Skeleton className="mt-3 h-8 w-16" />
            ) : (
              <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{stats.rate}%</p>
            )}
            <Progress value={stats.rate} className="mt-3 h-1.5" aria-label="Porcentaje de tareas completadas" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-none lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Tareas completadas</CardTitle>
            <CardDescription>
              Últimos 7 días · <span className="tabular-nums">{weekTotal}</span> en total
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 pl-0 pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perDay} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickFormatter={(v: string) => v.replace(".", "")}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                        <p className="font-medium capitalize">{String(payload[0].payload.label).replace(".", "")}</p>
                        <p className="text-muted-foreground">
                          <span className="font-medium tabular-nums text-foreground">{payload[0].value}</span> completadas
                        </p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Pendientes por prioridad</CardTitle>
            <CardDescription>Dónde está la carga de trabajo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            {byPriority.map(({ priority, count, share }) => (
              <div key={priority} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <PriorityFlag priority={priority} className="text-sm font-medium text-foreground" />
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", PRIORITY_BG[priority])}
                    style={{ width: `${share * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1.5">
            <CardTitle className="text-base font-semibold">Próximas tareas</CardTitle>
            <CardDescription>Lo más urgente de tu lista</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to={myBoards.length === 1 ? `/todos/${myBoards[0].id}` : "/todos"}>
              Ver todas <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : next.length ? (
            <ul className="space-y-0.5">
              {next.map((task) => (
                <HomeTaskItem key={task.id} task={task} />
              ))}
            </ul>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {!myBoards.length ? (
                <>
                  Aún no tienes tableros.{" "}
                  <Link to="/todos" className="font-medium text-primary underline underline-offset-2">
                    Crea tu primer tablero
                  </Link>
                </>
              ) : todos.length ? (
                "¡Todo al día! No tienes tareas pendientes."
              ) : (
                "Aún no tienes tareas. Añade la primera arriba."
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/** Cada tarea se actualiza en la caché de su propio tablero. */
function HomeTaskItem({ task }: { task: Task }) {
  const updateTask = useUpdateTask(task.board_id);
  return <CompactTaskItem task={task} onToggle={(completed) => updateTask.mutate({ id: task.id, completed })} />;
}

function StatTile({
  label,
  value,
  icon: Icon,
  loading,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof CircleDashed;
  loading: boolean;
  tone?: "success" | "danger";
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-5">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          {label}
          <Icon
            className={cn("size-4", tone === "success" && "text-success", tone === "danger" && "text-destructive")}
          />
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-8 w-12" />
        ) : (
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default Home;
