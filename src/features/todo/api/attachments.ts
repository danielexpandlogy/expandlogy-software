import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { BUCKET } from "../lib/media";
import { todoKeys } from "./keys";

const TTL_SECONDS = 60 * 60;

/**
 * URLs firmadas (bucket privado), una sola llamada por comentario. Caducan a la
 * hora; se renuevan a los 50 minutos para no mostrar enlaces vencidos.
 */
export function useSignedUrls(paths: string[]) {
  return useQuery({
    queryKey: todoKeys.signedUrls(paths),
    enabled: paths.length > 0,
    staleTime: 50 * 60_000,
    refetchInterval: 50 * 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, TTL_SECONDS);
      if (error) throw error;
      return Object.fromEntries(data.filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl]));
    },
  });
}
