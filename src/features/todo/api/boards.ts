import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { BoardSummary } from "@/lib/database.types";
import { useAuth } from "@/contexts/AuthContext";
import { todoKeys } from "./keys";

/** Tableros activos visibles (RLS: un admin ve todos; el resto, donde es miembro). */
export function useBoards() {
  const { session } = useAuth();
  return useQuery({
    queryKey: todoKeys.boards,
    enabled: !!session,
    queryFn: async (): Promise<BoardSummary[]> => {
      const { data, error } = await supabase.from("board_summaries").select("*").is("archived_at", null).order("name");
      if (error) throw error;
      return data.map((b) => ({
        ...b,
        member_count: Number(b.member_count),
        pending_count: Number(b.pending_count),
        completed_count: Number(b.completed_count),
      }));
    },
  });
}

/** Tableros en los que la persona está (los de su menú), por nombre. */
export function useMyBoards() {
  const boards = useBoards();
  const mine = (boards.data ?? []).filter((b) => b.is_member).sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { ...boards, data: mine };
}

export function useCreateBoard() {
  const qc = useQueryClient();
  return useMutation({
    // Quien crea siempre queda dentro; memberIds (otras personas) sólo lo usa un admin.
    mutationFn: async ({ name, memberIds = [] }: { name: string; memberIds?: string[] }) => {
      const { data, error } = await supabase.rpc("create_board", { p_name: name.trim(), p_member_ids: memberIds });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: todoKeys.boards }),
  });
}

/** Personas asignadas a un tablero (ids). */
export function useBoardMembers(boardId: string | undefined) {
  return useQuery({
    queryKey: ["todo", "members", boardId],
    enabled: !!boardId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from("board_members").select("user_id").eq("board_id", boardId!);
      if (error) throw error;
      return data.map((m) => m.user_id);
    },
  });
}

export function useSetBoardMembers(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberIds: string[]) => {
      const { error } = await supabase.rpc("set_board_members", { p_board_id: boardId, p_member_ids: memberIds });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["todo", "members", boardId] });
      qc.invalidateQueries({ queryKey: ["todo", "people", boardId] });
      qc.invalidateQueries({ queryKey: todoKeys.boards });
      toast.success("Personas del tablero actualizadas");
    },
  });
}

export function useUpdateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...changes }: { id: string; name?: string; archived_at?: string | null }) => {
      const { data, error } = await supabase.from("boards").update(changes).eq("id", id).select();
      if (error) throw error;
      if (!data.length) throw new Error("No tienes permiso para cambiar este tablero");
      return data[0];
    },
    onSuccess: (board) => {
      qc.invalidateQueries({ queryKey: todoKeys.boards });
      qc.invalidateQueries({ queryKey: todoKeys.board(board.id) });
    },
    onError: (e: Error) => toast.error("No se pudo actualizar el tablero", { description: e.message }),
  });
}
