import { supabase } from "@/lib/supabase";

export const BUCKET = "task-attachments";
export const MAX_ATTACHMENTS = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const MAX_RECORDING_MS = 10 * 60 * 1000;
export const MAX_IMAGE_SIDE = 2560;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const AUDIO_TYPES = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav"];

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

/** "audio/webm;codecs=opus" → "audio/webm" */
export const baseType = (mime: string) => mime.split(";")[0].trim().toLowerCase();

export type AttachmentKind = "image" | "audio";

/** Tipo de adjunto o motivo del rechazo (se muestra tal cual al usuario). */
export function classify(file: { type: string; size: number; name?: string }): { kind: AttachmentKind } | { error: string } {
  const type = baseType(file.type);
  if (IMAGE_TYPES.includes(type)) {
    return file.size > MAX_IMAGE_BYTES ? { error: `${file.name ?? "La imagen"} supera 10 MB` } : { kind: "image" };
  }
  if (AUDIO_TYPES.includes(type)) {
    return file.size > MAX_AUDIO_BYTES ? { error: `${file.name ?? "El audio"} supera 25 MB` } : { kind: "audio" };
  }
  return { error: `${file.name ?? "El archivo"}: sólo se admiten imágenes (JPG, PNG, WebP, GIF) y audios (MP3, M4A, WebM, OGG, WAV)` };
}

export const extensionFor = (mime: string) => EXT[baseType(mime)] ?? "bin";

/** {tablero}/{tarea}/{uuid}.{ext}: las políticas de Storage leen tablero y tarea de aquí. */
export const storagePathFor = (boardId: string, taskId: string, mime: string) =>
  `${boardId}/${taskId}/${crypto.randomUUID()}.${extensionFor(mime)}`;

/** Dimensiones finales al limitar el lado mayor, sin agrandar nunca. */
export function fitWithin(width: number, height: number, max = MAX_IMAGE_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Redimensiona y recomprime en el navegador (menos espacio en Storage y
 * subidas más rápidas desde el teléfono). Los GIF no se tocan, para no perder
 * la animación. Si la recompresión no ahorra, se usa el original.
 */
export async function prepareImage(file: Blob): Promise<{ blob: Blob; width: number; height: number; mime: string }> {
  const bitmap = await createImageBitmap(file);
  // Leer antes de close(): un ImageBitmap cerrado reporta 0×0.
  const original = { width: bitmap.width, height: bitmap.height };
  const { width, height } = fitWithin(original.width, original.height);
  const mime = baseType(file.type);
  if (mime === "image/gif" || (width === original.width && file.size < 1024 * 1024)) {
    bitmap.close();
    return { blob: file, ...original, mime };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  // PNG con transparencia → WebP (la conserva); el resto → JPEG.
  const outType = mime === "image/png" ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outType, 0.85));
  // Si recomprimir no ahorra, se sube el original con sus dimensiones reales.
  if (!blob || blob.size >= file.size) return { blob: file, ...original, mime };
  return { blob, width, height, mime: outType };
}

/** Duración de un audio en ms (null si el navegador no la conoce). */
export function probeAudioDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null);
    audio.onerror = () => done(null);
    audio.src = url;
  });
}

/** Formato de grabación que soporta el navegador (Chrome/Firefox: WebM; Safari: MP4). */
export function recordingMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

// Subidas en curso, para avisar antes de cerrar el panel.
let inFlight = 0;
export const uploadsInFlight = () => inFlight;

/**
 * Sube a Storage con XHR para tener progreso (supabase-js no lo expone). Mismo
 * endpoint y cabeceras que storage.upload, con upsert desactivado.
 */
export async function uploadWithProgress(
  path: string,
  blob: Blob,
  contentType: string,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;

  inFlight++;
  try {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_ANON_KEY);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.setRequestHeader("cache-control", "max-age=3600");
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        let message = `Error ${xhr.status}`;
        try {
          message = JSON.parse(xhr.responseText).message ?? message;
        } catch {
          /* respuesta no JSON */
        }
        reject(new Error(message));
      };
      xhr.onerror = () => reject(new Error("Sin conexión"));
      xhr.onabort = () => reject(new DOMException("Cancelado", "AbortError"));
      signal?.addEventListener("abort", () => xhr.abort());
      xhr.send(blob);
    });
  } finally {
    inFlight--;
  }
}

export const formatDuration = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
