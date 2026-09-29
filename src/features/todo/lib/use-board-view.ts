import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { readLocal, writeLocal } from "./use-local-state";

export type BoardView = "kanban" | "lista";

const isView = (v: unknown): v is BoardView => v === "kanban" || v === "lista";

/**
 * Prioridad: `?vista=` en la URL → última vista usada en este tablero
 * (localStorage) → por defecto: lista en móvil (el kanban exige scroll
 * horizontal), kanban en escritorio.
 */
export function resolveView(param: string | null, stored: unknown, isMobile: boolean): BoardView {
  if (isView(param)) return param;
  if (isView(stored)) return stored;
  return isMobile ? "lista" : "kanban";
}

const storageKey = (boardId: string) => `todo:view:${boardId}`;

// Síncrono (no useIsMobile): la vista por defecto no debe cambiar tras el primer render.
const mobileNow = () => {
  try {
    return window.matchMedia("(max-width: 767px)").matches;
  } catch {
    return false;
  }
};

export function useBoardView(boardId: string) {
  const [params, setParams] = useSearchParams();
  const view = resolveView(params.get("vista"), readLocal<unknown>(storageKey(boardId), null), mobileNow());

  const setView = useCallback(
    (next: BoardView) => {
      writeLocal(storageKey(boardId), next);
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("vista", next);
          return p;
        },
        { replace: true },
      );
    },
    [boardId, setParams],
  );

  return [view, setView] as const;
}
