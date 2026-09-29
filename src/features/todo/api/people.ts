import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { BoardPerson } from "@/lib/database.types";

/** Personas visibles en un tablero (autores de tareas y comentarios, admins, miembros). */
export function useBoardPeople(boardId: string | undefined) {
  return useQuery({
    queryKey: ["todo", "people", boardId],
    enabled: !!boardId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Map<string, BoardPerson>> => {
      const { data, error } = await supabase.rpc("board_people", { p_board_id: boardId! });
      if (error) throw error;
      return new Map((data ?? []).map((p) => [p.id, p]));
    },
  });
}
