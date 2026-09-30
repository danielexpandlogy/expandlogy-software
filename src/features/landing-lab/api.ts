import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Json, LpLandingTotals, LpOption, LpSettings, LpVariable, LpVariableConfig, LpVariableKind } from "@/lib/database.types";

/** Consultas del panel de administración (RLS: sólo admins). */

export interface OptionStats {
  visitors: number;
  clicks: number;
  conversions: number;
}

export type LabOption = LpOption & { stats: OptionStats };
export type LabVariable = Omit<LpVariable, "landing"> & { options: LabOption[] };

export interface LabData {
  settings: LpSettings;
  variables: LabVariable[];
  totals: Omit<LpLandingTotals, "landing">;
}

const labKey = (landing: string) => ["landing-lab", landing] as const;
const landingsKey = ["landing-lab", "landings"] as const;
const EMPTY_STATS: OptionStats = { visitors: 0, clicks: 0, conversions: 0 };

export function useLabData(landing: string) {
  return useQuery({
    queryKey: labKey(landing),
    // Los datos llegan mientras el panel está abierto.
    refetchInterval: 30_000,
    queryFn: async (): Promise<LabData> => {
      const [settings, variables, options, stats, totals] = await Promise.all([
        supabase.from("lp_settings").select("*").eq("landing", landing).single(),
        supabase.from("lp_variables").select("*").eq("landing", landing).order("position"),
        supabase.from("lp_options").select("*").order("position").order("created_at"),
        supabase.from("lp_option_stats").select("*"),
        supabase.from("lp_landing_totals").select("*").eq("landing", landing).single(),
      ]);
      for (const r of [settings, variables, options, stats, totals]) if (r.error) throw r.error;

      const statsById = new Map(
        (stats.data ?? []).map((s) => [
          s.option_id,
          { visitors: Number(s.visitors), clicks: Number(s.clicks), conversions: Number(s.conversions) },
        ]),
      );
      const t = totals.data!;
      return {
        settings: {
          ...settings.data!,
          win_probability: Number(settings.data!.win_probability),
          traffic_floor: Number(settings.data!.traffic_floor),
        },
        variables: (variables.data ?? []).map((v) => ({
          ...v,
          options: (options.data ?? [])
            .filter((o) => o.variable_id === v.id)
            .map((o) => ({ ...o, stats: statsById.get(o.id) ?? EMPTY_STATS })),
        })),
        totals: {
          visitors: Number(t.visitors),
          clicks: Number(t.clicks),
          conversions: Number(t.conversions),
          visitors_7d: Number(t.visitors_7d),
          conversions_7d: Number(t.conversions_7d),
        },
      };
    },
  });
}

function useLabMutation<T>(landing: string, fn: (input: T) => Promise<unknown>, errorTitle: string, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => success && toast.success(success),
    onError: (e: Error) => toast.error(errorTitle, { description: e.message }),
    // También refresca la lista de landings (nombre, variables en prueba).
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: labKey(landing) }), qc.invalidateQueries({ queryKey: landingsKey })]),
  });
}

export interface LandingSummary {
  settings: LpSettings;
  totals: Omit<LpLandingTotals, "landing">;
  variables: number;
  testing: number;
}

/** Todas las landings con sus totales, para /landings. */
export function useLandings() {
  return useQuery({
    queryKey: landingsKey,
    queryFn: async (): Promise<LandingSummary[]> => {
      const [settings, totals, variables] = await Promise.all([
        supabase.from("lp_settings").select("*").order("created_at"),
        supabase.from("lp_landing_totals").select("*"),
        supabase.from("lp_variables").select("landing, enabled, winner_option_id"),
      ]);
      for (const r of [settings, totals, variables]) if (r.error) throw r.error;
      return (settings.data ?? []).map((s) => {
        const t = totals.data?.find((x) => x.landing === s.landing);
        const vars = (variables.data ?? []).filter((v) => v.landing === s.landing);
        return {
          settings: s,
          totals: {
            visitors: Number(t?.visitors ?? 0),
            clicks: Number(t?.clicks ?? 0),
            conversions: Number(t?.conversions ?? 0),
            visitors_7d: Number(t?.visitors_7d ?? 0),
            conversions_7d: Number(t?.conversions_7d ?? 0),
          },
          variables: vars.length,
          testing: vars.filter((v) => v.enabled && !v.winner_option_id).length,
        };
      });
    },
  });
}

export function useCreateLanding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { landing: string; name: string; landing_url: string | null; thanks_url: string | null; accent_color: string }) => {
      const { error } = await supabase.from("lp_settings").insert(input);
      if (error) throw error.code === "23505" ? new Error("Ya existe una landing con ese identificador.") : error;
    },
    onSuccess: () => toast.success("Landing creada"),
    onError: (e: Error) => toast.error("No se creó la landing", { description: e.message }),
    onSettled: () => qc.invalidateQueries({ queryKey: landingsKey }),
  });
}

export function useUpdateSettings(landing: string) {
  return useLabMutation(
    landing,
    async (patch: Partial<Omit<LpSettings, "landing" | "updated_at" | "created_at">>) => {
      const { error } = await supabase
        .from("lp_settings")
        .update({ ...patch, updated_at: new Date().toISOString() } as typeof patch)
        .eq("landing", landing);
      if (error) throw error;
    },
    "No se guardaron los cambios",
    "Cambios guardados",
  );
}

export function useUpdateVariable(landing: string) {
  return useLabMutation(
    landing,
    async ({ id, ...patch }: { id: string; enabled?: boolean; winner_option_id?: string | null; name?: string; description?: string; config?: LpVariableConfig }) => {
      const { error } = await supabase.from("lp_variables").update(patch).eq("id", id);
      if (error) throw error;
    },
    "No se actualizó la variable",
  );
}

export interface NewVariable {
  key: string;
  name: string;
  kind: LpVariableKind;
  description: string;
  config: LpVariableConfig;
  controlLabel: string;
  controlValue: Record<string, unknown>;
}

/** Crea la variable apagada, con su opción original (lo que muestra hoy la landing). */
export function useCreateVariable(landing: string) {
  return useLabMutation(
    landing,
    async (v: NewVariable) => {
      const { error } = await supabase.rpc("lp_create_variable", {
        p_landing: landing,
        p_key: v.key,
        p_name: v.name,
        p_kind: v.kind,
        p_description: v.description,
        p_config: v.config as Json,
        p_control_label: v.controlLabel,
        p_control_value: v.controlValue as Json,
      });
      if (error) throw error.code === "23505" ? new Error("Ya hay una variable con esa key en esta landing.") : error;
    },
    "No se creó la variable",
    "Variable creada (apagada)",
  );
}

/** Borra la variable con sus opciones y resultados. */
export function useDeleteVariable(landing: string) {
  return useLabMutation(
    landing,
    async (id: string) => {
      const { error } = await supabase.from("lp_variables").delete().eq("id", id);
      if (error) throw error;
    },
    "No se eliminó la variable",
    "Variable eliminada",
  );
}

export function useSaveOption(landing: string) {
  return useLabMutation(
    landing,
    async (input: { id?: string; variable_id: string; label: string; value: Record<string, unknown>; position?: number }) => {
      const { id, variable_id, label, value, position } = input;
      const { error } = id
        ? await supabase.from("lp_options").update({ label, value }).eq("id", id)
        : await supabase.from("lp_options").insert({ variable_id, label, value, position });
      if (error) throw error;
    },
    "No se guardó la opción",
    "Opción guardada",
  );
}

export function useSetOptionActive(landing: string) {
  return useLabMutation(
    landing,
    async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("lp_options").update({ active }).eq("id", id);
      if (error) throw error;
    },
    "No se actualizó la opción",
  );
}

export function useDeleteOption(landing: string) {
  return useLabMutation(
    landing,
    async (id: string) => {
      const { error } = await supabase.from("lp_options").delete().eq("id", id);
      if (error) throw error;
    },
    "No se eliminó la opción",
    "Opción eliminada",
  );
}

/** Borra lo que vio cada visitante en esta variable: sus conteos vuelven a cero. */
export function useResetVariable(landing: string) {
  return useLabMutation(
    landing,
    async (variableId: string) => {
      const { error } = await supabase.from("lp_assignments").delete().eq("variable_id", variableId);
      if (error) throw error;
    },
    "No se reiniciaron los datos",
    "Datos de la variable reiniciados",
  );
}
