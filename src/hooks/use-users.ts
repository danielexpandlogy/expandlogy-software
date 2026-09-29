import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { AppRole, Profile } from "@/lib/database.types";

const KEY = ["profiles"] as const;

/** Los errores de la Edge Function traen el motivo en el body, no en `message`. */
async function invokeAdminUsers(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? error.message);
    }
    throw error;
  }
  return data;
}

export function useProfiles() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Profile[]> => {
      // RLS: un admin ve todos los perfiles.
      const { data, error } = await supabase.from("profiles").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: AppRole }) => {
      const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Rol actualizado");
    },
    onError: (e: Error) => toast.error("No se pudo cambiar el rol", { description: e.message }),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string; full_name: string; role: AppRole }) =>
      invokeAdminUsers({ action: "create", ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Usuario creado");
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => invokeAdminUsers({ action: "delete", user_id: userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Usuario eliminado");
    },
    onError: (e: Error) => toast.error("No se pudo eliminar el usuario", { description: e.message }),
  });
}
