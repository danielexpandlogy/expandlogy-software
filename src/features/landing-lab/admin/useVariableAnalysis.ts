import { useMemo } from "react";
import type { LpSettings } from "@/lib/database.types";
import { analyzeVariable } from "@danielexpandlogy/landing-core";
import type { LabOption, LabVariable } from "../api";

/** Fase, probabilidades y reparto de una variable, con lo que muestra el panel por opción. */
export function useVariableAnalysis(variable: LabVariable, settings: LpSettings) {
  return useMemo(() => {
    const active = variable.options.filter((o) => o.active);
    const winner = variable.options.find((o) => o.id === variable.winner_option_id);
    const analysis = analyzeVariable(
      active.map((o) => ({ id: o.id, ...o.stats })),
      settings,
      { enabled: variable.enabled, fixed: !!winner },
    );
    // Sin visitas, la "probabilidad de ser la mejor" es puro ruido del muestreo.
    const hasData = active.some((o) => o.stats.visitors > 0);

    /** Probabilidad de ser la mejor (null si no aplica). */
    const probOf = (o: LabOption) =>
      hasData && active.length > 1 && active.includes(o) ? analysis.probBest[active.indexOf(o)] : null;
    /** Parte del tráfico que recibe ahora (null si no recibe por estar apagada o pausada). */
    const shareOf = (o: LabOption) => {
      if (winner) return o.id === winner.id ? 1 : null;
      if (!variable.enabled || !o.active) return null;
      return analysis.shares[active.indexOf(o)];
    };

    return { active, winner, analysis, best: active[analysis.bestIndex] as LabOption | undefined, probOf, shareOf };
  }, [variable, settings]);
}
