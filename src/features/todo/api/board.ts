import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Database, Section, Task } from "@/lib/database.types";
import { useAuth } from "@/contexts/AuthContext";
import type { BoardData } from "../lib/tree";
import { todoKeys } from "./keys";

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
type SectionUpdate = Database["public"]["Tables"]["sections"]["Update"];

/** Tablero completo (secciones + tareas + subtareas) en una sola carga. */
export function useBoard(boardId: string | undefined) {
  return useQuery({
    queryKey: todoKeys.board(boardId ?? ""),
    enabled: !!boardId,
    queryFn: async (): Promise<BoardData> => {
      const [board, sections, tasks, counts] = await Promise.all([
        supabase.from("boards").select("*").eq("id", boardId!).maybeSingle(),
        supabase.from("sections").select("*").eq("board_id", boardId!),
        fetchAllTasks(boardId!),
        supabase.rpc("task_comment_counts", { p_board_id: boardId! }),
      ]);
      const error = board.error ?? sections.error ?? counts.error;
      if (error) throw error;
      if (!board.data) throw new BoardNotFoundError();
      const commentCounts = Object.fromEntries((counts.data ?? []).map((c) => [c.task_id, Number(c.count)]));
      return { board: board.data, sections: sections.data, tasks, commentCounts };
    },
    retry: (count, error) => !(error instanceof BoardNotFoundError) && count < 2,
  });
}

/** La API devuelve como máximo 1000 filas por petición: se pagina por id. */
export const TASKS_PAGE_SIZE = 1000;

async function fetchAllTasks(boardId: string): Promise<Task[]> {
  const all: Task[] = [];
  for (let from = 0; ; from += TASKS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("board_id", boardId)
      .order("id")
      .range(from, from + TASKS_PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < TASKS_PAGE_SIZE) return all;
  }
}

export class BoardNotFoundError extends Error {
  constructor() {
    super("El tablero no existe o no tienes acceso");
  }
}

/**
 * Mutación con actualización optimista sobre la caché del tablero: aplica el
 * cambio al instante y, si el servidor falla, restaura la foto anterior.
 */
function useBoardMutation<TVars, TResult>(
  boardId: string,
  opts: {
    mutationFn: (vars: TVars) => Promise<TResult>;
    optimistic: (data: BoardData, vars: TVars) => BoardData;
    reconcile?: (data: BoardData, result: TResult, vars: TVars) => BoardData;
    errorTitle: string;
  },
) {
  const qc = useQueryClient();
  const key = todoKeys.board(boardId);
  const mutationKey = ["todo", "board-mutation", boardId];
  return useMutation({
    mutationKey,
    mutationFn: opts.mutationFn,
    onMutate: async (vars: TVars) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<BoardData>(key);
      if (previous) qc.setQueryData<BoardData>(key, opts.optimistic(previous, vars));
      return { previous };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(opts.errorTitle, { description: e.message });
    },
    onSuccess: (result, vars) => {
      // Con otra escritura aún en vuelo, la respuesta de ésta pisaría el valor
      // optimista más reciente (p. ej. al escribir rápido); se descarta.
      if (!opts.reconcile || qc.isMutating({ mutationKey }) > 1) return;
      const current = qc.getQueryData<BoardData>(key);
      if (current) qc.setQueryData<BoardData>(key, opts.reconcile(current, result, vars));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todoKeys.boards }),
  });
}

const replaceTask = (data: BoardData, task: Task): BoardData => ({
  ...data,
  tasks: data.tasks.map((t) => (t.id === task.id ? task : t)),
});

// ── Tareas ────────────────────────────────────────────────────────────────

export type NewTask = Pick<Task, "title" | "position"> &
  Partial<Pick<Task, "section_id" | "parent_id" | "description" | "priority" | "due_date" | "reminder_at">>;

export function useCreateTask(boardId: string) {
  const { session } = useAuth();
  return useBoardMutation(boardId, {
    errorTitle: "No se pudo crear la tarea",
    // El id se genera en el cliente: la tarea optimista y la real son la misma
    // fila, así no hay que reemplazar ids temporales.
    mutationFn: async (vars: NewTask & { id: string }) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...vars, board_id: boardId, section_id: vars.parent_id ? null : vars.section_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    optimistic: (data, vars) => {
      const now = new Date().toISOString();
      const task: Task = {
        board_id: boardId,
        section_id: null,
        parent_id: null,
        description: "",
        priority: "medium",
        due_date: null,
        reminder_at: null,
        completed: false,
        completed_at: null,
        created_by: session?.user.id ?? null,
        created_at: now,
        updated_at: now,
        ...vars,
      };
      if (task.parent_id) task.section_id = null;
      return { ...data, tasks: [...data.tasks, task] };
    },
    reconcile: replaceTask,
  });
}

export function useUpdateTask(boardId: string) {
  return useBoardMutation(boardId, {
    errorTitle: "No se pudo actualizar la tarea",
    mutationFn: async ({ id, ...changes }: TaskUpdate & { id: string }) => {
      const { data, error } = await supabase.from("tasks").update(changes).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    optimistic: (data, { id, ...changes }) => ({
      ...data,
      tasks: data.tasks.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...changes };
        if (changes.completed !== undefined && changes.completed !== t.completed) {
          next.completed_at = changes.completed ? new Date().toISOString() : null;
        }
        return next;
      }),
    }),
    reconcile: replaceTask,
  });
}

/** Mover una tarea de sección y/o posición: una sola fila actualizada. */
export function useMoveTask(boardId: string) {
  const update = useUpdateTask(boardId);
  return {
    ...update,
    mutate: (vars: { id: string; section_id: string; position: string }) => update.mutate(vars),
  };
}

export function useDeleteTask(boardId: string) {
  return useBoardMutation(boardId, {
    errorTitle: "No se pudo eliminar la tarea",
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    // Las subtareas se borran en cascada en la base; aquí también.
    optimistic: (data, id) => ({ ...data, tasks: data.tasks.filter((t) => t.id !== id && t.parent_id !== id) }),
  });
}

// ── Secciones ─────────────────────────────────────────────────────────────

export function useCreateSection(boardId: string) {
  return useBoardMutation(boardId, {
    errorTitle: "No se pudo crear la sección",
    mutationFn: async (vars: { id: string; name: string; position: string }) => {
      const { data, error } = await supabase
        .from("sections")
        .insert({ ...vars, board_id: boardId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    optimistic: (data, vars) => ({
      ...data,
      sections: [...data.sections, { ...vars, board_id: boardId, created_at: new Date().toISOString() }],
    }),
    reconcile: (data, section: Section) => ({
      ...data,
      sections: data.sections.map((s) => (s.id === section.id ? section : s)),
    }),
  });
}

export function useUpdateSection(boardId: string) {
  return useBoardMutation(boardId, {
    errorTitle: "No se pudo actualizar la sección",
    mutationFn: async ({ id, ...changes }: SectionUpdate & { id: string }) => {
      const { error } = await supabase.from("sections").update(changes).eq("id", id);
      if (error) throw error;
    },
    optimistic: (data, { id, ...changes }) => ({
      ...data,
      sections: data.sections.map((s) => (s.id === id ? { ...s, ...changes } : s)),
    }),
  });
}

export function useDeleteSection(boardId: string) {
  return useBoardMutation(boardId, {
    errorTitle: "No se pudo eliminar la sección",
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sections").delete().eq("id", id);
      if (error) throw error;
    },
    optimistic: (data, id) => {
      const removed = new Set(data.tasks.filter((t) => t.section_id === id).map((t) => t.id));
      return {
        ...data,
        sections: data.sections.filter((s) => s.id !== id),
        tasks: data.tasks.filter((t) => !removed.has(t.id) && !(t.parent_id && removed.has(t.parent_id))),
      };
    },
  });
}
