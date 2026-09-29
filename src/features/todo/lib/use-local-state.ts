import { useCallback, useState } from "react";

// localStorage puede no existir o lanzar (modo privado, datos bloqueados):
// entonces la preferencia vive sólo en memoria y la app sigue funcionando.
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeLocal<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin persistencia */
  }
}

/** Preferencia personal por dispositivo (vista, colapsados, mostrar completadas). */
export function useLocalState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readLocal(key, fallback));
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        writeLocal(key, resolved);
        return resolved;
      });
    },
    [key],
  );
  return [value, set] as const;
}
