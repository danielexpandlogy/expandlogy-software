import { analyzeVariable, pickIndex, type BanditSettings } from "./bandit";

export interface PublicOption {
  id: string;
  label: string;
  value: Record<string, unknown>;
  is_control: boolean;
  active: boolean;
  position: number;
  visitors: number;
  conversions: number;
}

export interface PublicVariable {
  id: string;
  key: string;
  enabled: boolean;
  winner_option_id: string | null;
  options: PublicOption[];
}

export interface PublicConfig {
  settings: BanditSettings;
  variables: PublicVariable[];
}

export interface Selection {
  /** Valores a aplicar sobre la landing base, por key de variable. */
  values: Record<string, Record<string, unknown>>;
  /** Lo que se registra: {variable_id: option_id} (sin variables fijadas). */
  assignments: Record<string, string>;
  /** Resumen legible, p. ej. "headline:B|cta_text:A". */
  combo: string;
}

/** Letra de la opción según su orden en la variable: A = primera (normalmente el control). */
export const optionLetter = (index: number) => String.fromCharCode(65 + index);

/**
 * Decide qué ve el visitante. Conserva lo que ya vio si sigue disponible (la
 * misma persona siempre ve la misma combinación); si no, sortea según el reparto
 * del bandit. `preview` fuerza opciones sin importar su estado.
 */
export function chooseSelection(
  config: PublicConfig,
  stored: Record<string, string>,
  preview: string[] = [],
  random: () => number = Math.random,
): Selection {
  const values: Selection["values"] = {};
  const assignments: Selection["assignments"] = {};
  const combo: string[] = [];

  for (const variable of config.variables) {
    const forced = variable.options.find((o) => preview.includes(o.id));
    let chosen: PublicOption | undefined;

    if (forced) {
      chosen = forced;
    } else if (!variable.enabled) {
      continue;
    } else if (variable.winner_option_id) {
      chosen = variable.options.find((o) => o.id === variable.winner_option_id);
    } else {
      const active = variable.options.filter((o) => o.active);
      if (active.length === 0) continue;
      chosen = active.find((o) => o.id === stored[variable.id]);
      if (!chosen) {
        const { shares } = analyzeVariable(active, config.settings, { enabled: true, fixed: false });
        chosen = active[pickIndex(shares, random())];
      }
      assignments[variable.id] = chosen.id;
    }

    if (!chosen) continue;
    values[variable.key] = chosen.value;
    combo.push(`${variable.key}:${optionLetter(variable.options.indexOf(chosen))}`);
  }

  return { values, assignments, combo: combo.join("|") };
}
