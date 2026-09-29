import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Section, Task, TaskComment } from "@/lib/database.types";
import type { BoardData } from "../lib/tree";
import { todoKeys } from "./keys";

export type RealtimeStatus = "connecting" | "live" | "offline";

type Row = Record<string, unknown> & { id: string };

/**
 * Instante de un timestamp de Postgres. Realtime y PostgREST pueden formatearlo
 * distinto ("2026-09-29 05:28:08.03+00" vs "2026-09-29T05:28:08.03+00:00"):
 * compararlos como texto daría resultados falsos.
 */
export function toMillis(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const iso = value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** Aplica un evento de tasks/sections a la lista de la caché (upsert o borrado). */
export function applyChange<T extends Row>(list: T[], event: "INSERT" | "UPDATE" | "DELETE", row: Partial<T> & { id: string }): T[] {
  if (event === "DELETE") return list.some((x) => x.id === row.id) ? list.filter((x) => x.id !== row.id) : list;
  const i = list.findIndex((x) => x.id === row.id);
  if (i === -1) return [...list, row as T];
  const current = list[i];
  // Un evento más viejo que lo que ya hay (p. ej. llega tarde) no pisa lo nuevo.
  const a = toMillis(current.updated_at);
  const b = toMillis(row.updated_at);
  if (a !== null && b !== null && b < a) return list;
  // Sin cambios reales (eco de una escritura propia ya reconciliada): misma referencia.
  if (Object.keys(row).every((k) => current[k] === row[k as keyof T])) return list;
  const next = [...list];
  next[i] = { ...current, ...row };
  return next;
}

/**
 * Cambios en vivo de un tablero: tareas, secciones y comentarios de otras
 * personas (o de otra pestaña) se reflejan sin recargar.
 *
 * - Con escrituras propias en vuelo no se aplican eventos (el eco de una
 *   escritura anterior podría pisar el valor optimista más reciente); al
 *   terminar se resincroniza el tablero.
 * - Tras perder la conexión, al volver se recarga todo el tablero.
 */
export function useBoardRealtime(boardId: string | undefined) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const wasLive = useRef(false);

  useEffect(() => {
    if (!boardId) return;
    const boardKey = todoKeys.board(boardId);
    const mutationKey = ["todo", "board-mutation", boardId];
    let deferred: ReturnType<typeof setTimeout> | undefined;
    let countsTimer: ReturnType<typeof setTimeout> | undefined;

    const resyncSoon = () => {
      clearTimeout(deferred);
      deferred = setTimeout(() => {
        if (qc.isMutating({ mutationKey }) > 0) return resyncSoon();
        void qc.invalidateQueries({ queryKey: boardKey });
      }, 800);
    };

    const onBoardRow =
      <T extends Row>(field: "tasks" | "sections") =>
      (payload: RealtimePostgresChangesPayload<T>) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Partial<T> & { id: string };
        if (!row?.id) return;
        // Los DELETE no se pueden filtrar por board_id: se ignoran si no son de este tablero.
        if (payload.eventType !== "DELETE" && row.board_id !== boardId) return;
        if (qc.isMutating({ mutationKey }) > 0) return resyncSoon();
        qc.setQueryData<BoardData>(boardKey, (data) => {
          if (!data) return data;
          const list = data[field] as unknown as T[];
          let next = applyChange(list, payload.eventType, row);
          // Borrar una tarea borra sus subtareas en cascada (la base no emite un evento por cada una).
          if (field === "tasks" && payload.eventType === "DELETE") {
            next = next.filter((t) => (t as unknown as Task).parent_id !== row.id);
          }
          if (field === "sections" && payload.eventType === "DELETE") {
            const removed = new Set(data.tasks.filter((t) => t.section_id === row.id).map((t) => t.id));
            return {
              ...data,
              sections: next as unknown as Section[],
              tasks: data.tasks.filter((t) => !removed.has(t.id) && !(t.parent_id && removed.has(t.parent_id))),
            };
          }
          return next === list ? data : { ...data, [field]: next };
        });
      };

    const onComment = (payload: RealtimePostgresChangesPayload<TaskComment>) => {
      const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Partial<TaskComment>;
      // La lista abierta se relee (trae adjuntos); los conteos, agrupados.
      if (row.task_id) void qc.invalidateQueries({ queryKey: todoKeys.comments(row.task_id) });
      else void qc.invalidateQueries({ queryKey: ["todo", "comments"] });
      clearTimeout(countsTimer);
      countsTimer = setTimeout(async () => {
        const { data } = await supabase.rpc("task_comment_counts", { p_board_id: boardId });
        if (!data) return;
        const commentCounts = Object.fromEntries(data.map((c) => [c.task_id, Number(c.count)]));
        qc.setQueryData<BoardData>(boardKey, (d) => (d ? { ...d, commentCounts } : d));
      }, 300);
    };

    const filter = `board_id=eq.${boardId}`;
    const channel = supabase
      .channel(`board:${boardId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks", filter }, onBoardRow<Task & Row>("tasks"))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks", filter }, onBoardRow<Task & Row>("tasks"))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tasks" }, onBoardRow<Task & Row>("tasks"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sections", filter }, onBoardRow<Section & Row>("sections"))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sections", filter }, onBoardRow<Section & Row>("sections"))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "sections" }, onBoardRow<Section & Row>("sections"))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_comments", filter }, onComment)
      .subscribe((s) => {
        if (s === "SUBSCRIBED") {
          // Reconexión: lo que pasó mientras no había conexión se trae de nuevo.
          if (wasLive.current) {
            void qc.invalidateQueries({ queryKey: boardKey });
            void qc.invalidateQueries({ queryKey: ["todo", "comments"] });
          }
          wasLive.current = true;
          setStatus("live");
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          setStatus("offline");
        }
      });

    // Cortes breves no llegan a cerrar el socket (el latido tarda ~30 s): el
    // navegador avisa antes. Al volver la red se resincroniza igualmente.
    const goOffline = () => setStatus("offline");
    const goOnline = () => {
      setStatus(channel.state === "joined" ? "live" : "connecting");
      void qc.invalidateQueries({ queryKey: boardKey });
      void qc.invalidateQueries({ queryKey: ["todo", "comments"] });
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    return () => {
      clearTimeout(deferred);
      clearTimeout(countsTimer);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      wasLive.current = false;
      void supabase.removeChannel(channel);
    };
  }, [boardId, qc]);

  return status;
}
