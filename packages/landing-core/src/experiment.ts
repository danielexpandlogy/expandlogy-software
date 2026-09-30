import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rpc } from "./client";
import { chooseSelection, type PublicConfig, type Selection } from "./assign";
import { isTeamBrowser, readPreview } from "./params";
import { loadVisit, newVisitorId, readUtm, saveVisit } from "./visitor";

const EMPTY: Selection = { values: {}, assignments: {}, combo: "" };
/** Si la configuración tarda más que esto, se muestra la landing original sin registrar. */
const CONFIG_TIMEOUT_MS = 2500;

/** track: visitante real · skip: equipo o vista previa · pending: aún no se sabe. */
export type TrackMode = "pending" | "track" | "skip";

interface ExperimentState {
  ready: boolean;
  selection: Selection;
  /** false si no llegó la configuración (se muestra el original y no se registra nada). */
  live: boolean;
}

const warn = (what: string) => (e: unknown) => console.warn(`[landing-lab] ${what}:`, e instanceof Error ? e.message : e);

/**
 * Elige la combinación del visitante y la registra. Los visitantes nunca tocan
 * tablas, sólo las funciones públicas lp_*.
 */
export function useExperiment(landing: string, { mode, preview }: { mode: TrackMode; preview: string[] }) {
  const [state, setState] = useState<ExperimentState>({ ready: false, selection: EMPTY, live: false });
  const tracked = useRef(false);
  const previewKey = preview.join(",");

  useEffect(() => {
    let done = false;
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      setState({ ready: true, selection: EMPTY, live: false });
    }, CONFIG_TIMEOUT_MS);

    const finish = (config: PublicConfig | null) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      if (!config) {
        setState({ ready: true, selection: EMPTY, live: false });
        return;
      }
      const stored = loadVisit(landing);
      const ids = previewKey ? previewKey.split(",") : [];
      setState({ ready: true, selection: chooseSelection(config, stored?.assignments ?? {}, ids), live: true });
    };

    rpc<PublicConfig | null>("lp_public_config", { p_landing: landing }).then(finish, (e) => {
      warn("Sin configuración")(e);
      finish(null);
    });

    return () => {
      done = true;
      window.clearTimeout(timer);
    };
  }, [landing, previewKey]);

  useEffect(() => {
    if (!state.live || mode !== "track" || tracked.current) return;
    tracked.current = true;
    const stored = loadVisit(landing);
    const visitorId = stored?.visitorId ?? newVisitorId();
    saveVisit(landing, {
      ...stored,
      visitorId,
      assignments: state.selection.assignments,
      combo: state.selection.combo,
    });
    rpc("lp_track_visit", {
      p_landing: landing,
      p_visitor_id: visitorId,
      p_assignments: state.selection.assignments,
      p_utm: readUtm(window.location.search),
    }).catch(warn("No se registró la visita"));
  }, [landing, mode, state.live, state.selection]);

  const trackClick = useCallback(() => {
    if (mode !== "track") return;
    const visit = loadVisit(landing);
    if (!visit || visit.clicked) return;
    saveVisit(landing, { ...visit, clicked: true });
    // keepalive: el clic puede llevar a otra página antes de que termine la llamada.
    rpc("lp_track_event", { p_landing: landing, p_visitor_id: visit.visitorId, p_event: "cta_click" }, { keepalive: true }).catch(
      warn("No se registró el clic"),
    );
  }, [landing, mode]);

  return { ...state, trackClick };
}

/**
 * Lo que necesita una landing en un dominio propio: lee ?lp_preview y ?lp_team
 * de la URL, decide si se registra la visita y elige la combinación.
 * `skip` suma otros motivos para no registrar; `pending` espera antes de decidir.
 */
export function useLandingLab(landing: string, { skip = false, pending = false }: { skip?: boolean; pending?: boolean } = {}) {
  const { preview, team } = useMemo(() => {
    const search = typeof window === "undefined" ? "" : window.location.search;
    return { preview: readPreview(search), team: isTeamBrowser(search) };
  }, []);
  const mode: TrackMode = preview.length || team || skip ? "skip" : pending ? "pending" : "track";
  const experiment = useExperiment(landing, { mode, preview });
  const reason = preview.length ? "preview" : team ? "team" : skip ? "skip" : null;
  return { ...experiment, mode, preview, reason } as const;
}

/**
 * Registra la agenda del visitante (página de gracias). Devuelve su combinación,
 * o null si llegó sin pasar por la landing en este navegador.
 */
export async function trackConversion(landing: string): Promise<string | null> {
  const visit = loadVisit(landing);
  if (!visit) return null;
  if (!visit.converted) {
    try {
      await rpc("lp_track_event", { p_landing: landing, p_visitor_id: visit.visitorId, p_event: "conversion" });
      saveVisit(landing, { ...visit, converted: true });
    } catch (e) {
      // Sólo se marca si llegó: si falló, al recargar la página de gracias se reintenta.
      warn("No se registró la agenda")(e);
    }
  }
  return visit.combo;
}

/**
 * Hook para la página de gracias. Si la plataforma de agenda la abre dentro de
 * su iframe, la lleva a la ventana principal y registra desde ahí.
 */
export function useTrackConversion(landing: string) {
  useEffect(() => {
    if (window.top !== window.self) {
      try {
        window.top!.location.href = window.location.href;
        return;
      } catch {
        // Ventana principal de otro dominio: se registra desde aquí.
      }
    }
    void trackConversion(landing);
  }, [landing]);
}
