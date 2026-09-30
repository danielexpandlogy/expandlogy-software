/**
 * Identidad del visitante en su navegador. Si localStorage no está disponible
 * (modo privado, bloqueado), todo sigue funcionando pero sin memoria: cada
 * visita cuenta como alguien nuevo y la página de gracias no puede atribuir.
 */

export interface StoredVisit {
  visitorId: string;
  assignments: Record<string, string>;
  combo: string;
  clicked?: boolean;
  converted?: boolean;
}

const storageKey = (landing: string) => `lp:${landing}`;

export function loadVisit(landing: string): StoredVisit | null {
  try {
    const raw = localStorage.getItem(storageKey(landing));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredVisit;
    return typeof parsed?.visitorId === "string" && parsed.assignments ? parsed : null;
  } catch {
    return null;
  }
}

export function saveVisit(landing: string, visit: StoredVisit) {
  try {
    localStorage.setItem(storageKey(landing), JSON.stringify(visit));
  } catch {
    // Sin almacenamiento: se pierde la memoria, no la visita.
  }
}

export function newVisitorId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Navegadores viejos: UUID v4 con Math.random.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** utm_* de la URL, para saber de qué anuncio vino cada visitante. */
export function readUtm(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const utm: Record<string, string> = {};
  params.forEach((value, key) => {
    if (key.startsWith("utm_") && key.length <= 20) utm[key] = value.slice(0, 200);
  });
  return utm;
}
