import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { BoardSummary } from "@/lib/database.types";
import { useAuth } from "@/contexts/AuthContext";
import { todoKeys } from "./keys";

/** Tableros activos visibles para quien consulta (RLS: un admin ve todos). */
export function useBoards() {
  const { session } = useAuth();
  return useQuery({
    queryKey: todoKeys.boards,
    enabled: !!session,
    queryFn: async (): Promise<BoardSummary[]> => {
      const { data, error } = await supabase
        .from("board_summaries")
        .select("*")
        .is("archived_at", null)
        .order("owner_name");
      if (error) throw error;
      return data.map((b) => ({ ...b, pending_count: Number(b.pending_count), completed_count: Number(b.completed_count) }));
    },
  });
}

/** El tablero activo del que la persona en sesión es dueña, si existe. */
export function useMyBoard() {
  const { session } = useAuth();
  const boards = useBoards();
  const mine = boards.data?.find((b) => b.owner_id === session?.user.id) ?? null;
  return { ...boards, data: mine };
}

export function useCreateBoardForUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, name }: { userId: string; name: string }) => {
      const { data, error } = await supabase.rpc("create_board_for_user", { p_user_id: userId, p_name: name.trim() });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: todoKeys.boards }),
  });
}

export function useUpdateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...changes }: { id: string; name?: string; archived_at?: string | null }) => {
      const { data, error } = await supabase.from("boards").update(changes).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (board) => {
      qc.invalidateQueries({ queryKey: todoKeys.boards });
      qc.invalidateQueries({ queryKey: todoKeys.board(board.id) });
    },
    onError: (e: Error) => toast.error("No se pudo actualizar el tablero", { description: e.message }),
  });
}
