import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { CommentWithAttachments, NewAttachment, TaskComment } from "@/lib/database.types";
import type { BoardData } from "../lib/tree";
import { todoKeys } from "./keys";

export const COMMENTS_PAGE_SIZE = 50;

type Pages = InfiniteData<CommentWithAttachments[], string | null>;

/** Comentarios de una tarea: páginas de 50, de la más reciente a la más antigua. */
export function useComments(taskId: string) {
  return useInfiniteQuery({
    queryKey: todoKeys.comments(taskId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<CommentWithAttachments[]> => {
      let q = supabase
        .from("task_comments")
        .select("*, comment_attachments(*)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(COMMENTS_PAGE_SIZE);
      if (pageParam) q = q.lt("created_at", pageParam);
      const { data, error } = await q;
      if (error) throw error;
      return data as CommentWithAttachments[];
    },
    getNextPageParam: (last) => (last.length === COMMENTS_PAGE_SIZE ? last[last.length - 1].created_at : undefined),
  });
}

/** Lista cronológica (más antiguo arriba) a partir de las páginas. */
export const chronological = (pages: CommentWithAttachments[][] | undefined) => (pages ?? []).flat().reverse();

function bumpCount(qc: ReturnType<typeof useQueryClient>, boardId: string, taskId: string, delta: number) {
  qc.setQueryData<BoardData>(todoKeys.board(boardId), (d) =>
    d ? { ...d, commentCounts: { ...d.commentCounts, [taskId]: Math.max(0, (d.commentCounts[taskId] ?? 0) + delta) } } : d,
  );
}

export function useCreateComment(boardId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, attachments = [] }: { body: string; attachments?: NewAttachment[] }) => {
      const { data, error } = await supabase.rpc("create_comment", {
        p_task_id: taskId,
        p_body: body,
        p_attachments: attachments,
      });
      if (error) throw error;
      if (!attachments.length) return { ...data, comment_attachments: [] } as CommentWithAttachments;
      // Con adjuntos: se relee para traer las filas que creó el servidor.
      const { data: full, error: e2 } = await supabase
        .from("task_comments")
        .select("*, comment_attachments(*)")
        .eq("id", data.id)
        .single();
      if (e2) throw e2;
      return full as CommentWithAttachments;
    },
    onSuccess: (comment) => {
      qc.setQueryData<Pages>(todoKeys.comments(taskId), (d) =>
        d ? { ...d, pages: [[comment, ...(d.pages[0] ?? [])], ...d.pages.slice(1)] } : d,
      );
      bumpCount(qc, boardId, taskId, 1);
    },
  });
}

const mapComments = (d: Pages | undefined, fn: (list: CommentWithAttachments[]) => CommentWithAttachments[]) =>
  d ? { ...d, pages: d.pages.map(fn) } : d;

export function useUpdateComment(taskId: string) {
  const qc = useQueryClient();
  const key = todoKeys.comments(taskId);
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { data, error } = await supabase.from("task_comments").update({ body }).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Pages>(key);
      qc.setQueryData<Pages>(key, (d) =>
        mapComments(d, (l) => l.map((c) => (c.id === id ? { ...c, body, edited_at: new Date().toISOString() } : c))),
      );
      return { previous };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error("No se pudo editar el comentario", { description: e.message });
    },
    onSuccess: (comment) =>
      qc.setQueryData<Pages>(key, (d) => mapComments(d, (l) => l.map((c) => (c.id === comment.id ? { ...c, ...comment } : c)))),
  });
}

export function useDeleteComment(boardId: string, taskId: string) {
  const qc = useQueryClient();
  const key = todoKeys.comments(taskId);
  return useMutation({
    mutationFn: async (comment: TaskComment & { comment_attachments?: { storage_path: string }[] }) => {
      // Primero los archivos; si quedara alguno (p. ej. sin permiso), lo recoge attachments-gc.
      const paths = (comment.comment_attachments ?? []).map((a) => a.storage_path);
      if (paths.length) await supabase.storage.from("task-attachments").remove(paths);
      const { data, error } = await supabase.from("task_comments").delete().eq("id", comment.id).select("id");
      if (error) throw error;
      if (!data.length) throw new Error("No tienes permiso para eliminar este comentario");
    },
    onMutate: async (comment) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Pages>(key);
      qc.setQueryData<Pages>(key, (d) => mapComments(d, (l) => l.filter((c) => c.id !== comment.id)));
      bumpCount(qc, boardId, taskId, -1);
      return { previous };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      bumpCount(qc, boardId, taskId, 1);
      toast.error("No se pudo eliminar el comentario", { description: e.message });
    },
  });
}
