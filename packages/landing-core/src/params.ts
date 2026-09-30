/**
 * Parámetros de URL que entiende cualquier landing:
 * - ?lp_preview=<option_id>[,<option_id>…]  fuerza opciones (vistas previas del panel); no se registra.
 * - ?lp_team=1 / ?lp_team=0                  marca o desmarca este navegador como del equipo; no se registra.
 */

const TEAM_KEY = "lp:team";

export function readPreview(search: string): string[] {
  return (new URLSearchParams(search).get("lp_preview") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/**
 * true si este navegador es del equipo. Las landings viven en otros dominios,
 * así que no ven la sesión del panel: el equipo abre la landing una vez con
 * ?lp_team=1 y desde entonces sus visitas no cuentan.
 */
export function isTeamBrowser(search: string): boolean {
  const flag = new URLSearchParams(search).get("lp_team");
  try {
    if (flag === "1") localStorage.setItem(TEAM_KEY, "1");
    if (flag === "0") localStorage.removeItem(TEAM_KEY);
    return localStorage.getItem(TEAM_KEY) === "1";
  } catch {
    return flag === "1";
  }
}
