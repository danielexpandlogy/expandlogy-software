import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { NewAttachment } from "@/lib/database.types";
import {
  BUCKET,
  classify,
  MAX_ATTACHMENTS,
  prepareImage,
  probeAudioDuration,
  storagePathFor,
  uploadWithProgress,
  type AttachmentKind,
} from "./media";

export interface AttachmentDraft {
  id: string;
  kind: AttachmentKind;
  name: string;
  /** URL local para la vista previa (se revoca al quitar). */
  previewUrl: string;
  status: "processing" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  path?: string;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}

/**
 * Adjuntos de un comentario en preparación: se procesan (redimensionar,
 * medir duración) y se suben al añadirlos, así "Enviar" sólo espera a los que
 * falten. Si el comentario no se llega a enviar, attachments-gc limpia lo subido.
 */
export function useAttachmentDrafts(boardId: string, taskId: string) {
  const [drafts, setDrafts] = useState<AttachmentDraft[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const patch = (id: string, changes: Partial<AttachmentDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...changes } : d)));

  const upload = useCallback(
    async (id: string, blob: Blob, mime: string, meta: Partial<AttachmentDraft>) => {
      const path = storagePathFor(boardId, taskId, mime);
      const controller = new AbortController();
      controllers.current.set(id, controller);
      patch(id, { status: "uploading", progress: 0, path, ...meta });
      try {
        await uploadWithProgress(path, blob, mime, (p) => patch(id, { progress: p }), controller.signal);
        patch(id, { status: "done", progress: 1 });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        patch(id, { status: "error", error: (e as Error).message });
      } finally {
        controllers.current.delete(id);
      }
    },
    [boardId, taskId],
  );

  const addFiles = useCallback(
    (files: Iterable<File>) => {
      const list = [...files];
      const room = MAX_ATTACHMENTS - draftsRef.current.length;
      if (list.length > room) toast.error(`Máximo ${MAX_ATTACHMENTS} adjuntos por comentario`);
      for (const file of list.slice(0, Math.max(0, room))) {
        const result = classify(file);
        if ("error" in result) {
          toast.error("Archivo no admitido", { description: result.error });
          continue;
        }
        const id = crypto.randomUUID();
        const draft: AttachmentDraft = {
          id,
          kind: result.kind,
          name: file.name,
          previewUrl: URL.createObjectURL(file),
          status: "processing",
          progress: 0,
        };
        setDrafts((prev) => [...prev, draft]);
        void (async () => {
          try {
            if (result.kind === "image") {
              const img = await prepareImage(file);
              await upload(id, img.blob, img.mime, { width: img.width, height: img.height });
            } else {
              const durationMs = await probeAudioDuration(file);
              await upload(id, file, file.type, { durationMs });
            }
          } catch (e) {
            patch(id, { status: "error", error: (e as Error).message || "No se pudo procesar el archivo" });
          }
        })();
      }
    },
    [upload],
  );

  /** Grabación del navegador: la duración la mide el grabador (los WebM de Chrome dicen Infinity). */
  const addRecording = useCallback(
    (blob: Blob, durationMs: number) => {
      if (draftsRef.current.length >= MAX_ATTACHMENTS) {
        toast.error(`Máximo ${MAX_ATTACHMENTS} adjuntos por comentario`);
        return;
      }
      const id = crypto.randomUUID();
      setDrafts((prev) => [
        ...prev,
        { id, kind: "audio", name: "Nota de voz", previewUrl: URL.createObjectURL(blob), status: "processing", progress: 0 },
      ]);
      void upload(id, blob, blob.type, { durationMs });
    },
    [upload],
  );

  const remove = useCallback((id: string) => {
    const d = draftsRef.current.find((x) => x.id === id);
    if (!d) return;
    controllers.current.get(id)?.abort();
    URL.revokeObjectURL(d.previewUrl);
    if (d.status === "done" && d.path) void supabase.storage.from(BUCKET).remove([d.path]);
    setDrafts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  /** Tras enviar: los archivos ya pertenecen al comentario, no se borran. */
  const clear = useCallback(() => {
    for (const d of draftsRef.current) URL.revokeObjectURL(d.previewUrl);
    setDrafts([]);
  }, []);

  useEffect(
    () => () => {
      for (const c of controllers.current.values()) c.abort();
      for (const d of draftsRef.current) URL.revokeObjectURL(d.previewUrl);
    },
    [],
  );

  const ready: NewAttachment[] = drafts
    .filter((d) => d.status === "done" && d.path)
    .map((d) => ({
      storage_path: d.path!,
      kind: d.kind,
      width: d.width ?? null,
      height: d.height ?? null,
      duration_ms: d.durationMs ?? null,
    }));

  return {
    drafts,
    ready,
    busy: drafts.some((d) => d.status === "processing" || d.status === "uploading"),
    hasErrors: drafts.some((d) => d.status === "error"),
    addFiles,
    addRecording,
    remove,
    clear,
  };
}
