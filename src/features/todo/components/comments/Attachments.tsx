import { useEffect, useRef, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Download, Loader2, Mic, Pause, Play, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CommentAttachment } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { useSignedUrls } from "../../api/attachments";
import { formatDuration } from "../../lib/media";
import type { AttachmentDraft } from "../../lib/use-attachment-drafts";

/** Adjuntos de un comentario enviado: miniaturas + reproductores. */
export function AttachmentGallery({ attachments }: { attachments: CommentAttachment[] }) {
  const { data: urls, isError } = useSignedUrls(attachments.map((a) => a.storage_path));
  const images = attachments.filter((a) => a.kind === "image");
  const audios = attachments.filter((a) => a.kind === "audio");
  const [viewer, setViewer] = useState<number | null>(null);

  if (!attachments.length) return null;
  if (isError) return <p className="mt-2 text-xs text-destructive">No se pudieron cargar los adjuntos.</p>;

  return (
    <div className="mt-2 space-y-2">
      {images.length > 0 && (
        <div className={cn("grid gap-1.5", images.length === 1 ? "max-w-xs grid-cols-1" : "grid-cols-3 sm:grid-cols-4")}>
          {images.map((img, i) => {
            const url = urls?.[img.storage_path];
            // width/height guardados: el hueco tiene el tamaño correcto antes de cargar.
            const ratio = img.width && img.height && img.width > 0 && img.height > 0 ? `${img.width} / ${img.height}` : "1 / 1";
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => setViewer(i)}
                className="group relative overflow-hidden rounded-lg border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ aspectRatio: images.length === 1 ? ratio : "1 / 1" }}
                aria-label={`Ver imagen ${i + 1} de ${images.length}`}
              >
                {url ? (
                  // Absoluta: si no, el tamaño intrínseco de la imagen le gana al aspect-ratio.
                  <img src={url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-[1.02]" />
                ) : (
                  <Skeleton className="absolute inset-0 rounded-none" />
                )}
              </button>
            );
          })}
        </div>
      )}
      {audios.map((a) => (
        <AudioPlayer key={a.id} src={urls?.[a.storage_path]} durationMs={a.duration_ms} />
      ))}
      {viewer !== null && (
        <ImageLightbox images={images} urls={urls ?? {}} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}

function ImageLightbox({
  images,
  urls,
  index,
  onIndex,
  onClose,
}: {
  images: CommentAttachment[];
  urls: Record<string, string>;
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const img = images[index];
  const url = urls[img.storage_path];
  const go = (d: number) => onIndex((index + d + images.length) % images.length);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[min(96vw,1200px)] border-none bg-black/95 p-2 text-white sm:p-4 [&>button]:text-white"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
      >
        <DialogTitle className="sr-only">
          Imagen {index + 1} de {images.length}
        </DialogTitle>
        <DialogDescription className="sr-only">Usa las flechas para ver las demás imágenes.</DialogDescription>
        <div className="flex max-h-[85vh] items-center justify-center">
          {url ? <img src={url} alt={`Imagen ${index + 1}`} className="max-h-[85vh] max-w-full object-contain" /> : <Loader2 className="size-6 animate-spin" />}
        </div>
        <div className="flex items-center justify-between gap-2 pt-2">
          <span className="text-sm tabular-nums text-white/70">
            {index + 1} / {images.length}
          </span>
          <div className="flex gap-1">
            {images.length > 1 && (
              <>
                <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={() => go(-1)} aria-label="Anterior">
                  <ChevronLeft className="size-5" />
                </Button>
                <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={() => go(1)} aria-label="Siguiente">
                  <ChevronRight className="size-5" />
                </Button>
              </>
            )}
            {url && (
              <Button asChild size="icon" variant="ghost" className="text-white hover:bg-white/10" aria-label="Descargar">
                <a href={`${url}&download`} download>
                  <Download className="size-5" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Reproductor compacto sobre <audio> nativo. */
export function AudioPlayer({ src, durationMs }: { src?: string; durationMs?: number | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState((durationMs ?? 0) / 1000);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const onTime = () => setCurrent(el.currentTime);
    const onMeta = () => Number.isFinite(el.duration) && setTotal(el.duration);
    const onEnd = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const events: [string, () => void][] = [
      ["timeupdate", onTime],
      ["loadedmetadata", onMeta],
      ["durationchange", onMeta],
      ["ended", onEnd],
      ["pause", onEnd],
      ["play", onPlay],
    ];
    for (const [name, fn] of events) el.addEventListener(name, fn);
    return () => {
      for (const [name, fn] of events) el.removeEventListener(name, fn);
    };
  }, [src]);

  const toggle = () => {
    const el = audio.current;
    if (!el || !src) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  return (
    <div className="flex max-w-sm items-center gap-2 rounded-full border bg-muted/40 py-1 pl-1 pr-3" data-testid="audio-player">
      <audio ref={audio} src={src} preload="metadata" />
      <Button
        type="button"
        size="icon"
        className="size-8 shrink-0 rounded-full"
        onClick={toggle}
        disabled={!src}
        aria-label={playing ? "Pausar audio" : "Reproducir audio"}
      >
        {playing ? <Pause className="size-3.5 fill-current" /> : <Play className="ml-0.5 size-3.5 fill-current" />}
      </Button>
      <input
        type="range"
        min={0}
        max={total || 0}
        step={0.1}
        value={current}
        onChange={(e) => {
          if (audio.current) audio.current.currentTime = Number(e.target.value);
        }}
        aria-label="Posición del audio"
        className="h-1 min-w-0 flex-1 cursor-pointer accent-primary"
      />
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatDuration((playing || current ? current : total) * 1000)}
        {total > 0 && (playing || current > 0) ? ` / ${formatDuration(total * 1000)}` : ""}
      </span>
    </div>
  );
}

/** Adjuntos en borrador bajo el composer: miniatura, progreso, error y ✕. */
export function AttachmentChips({ drafts, onRemove }: { drafts: AttachmentDraft[]; onRemove: (id: string) => void }) {
  if (!drafts.length) return null;
  return (
    <ul className="flex flex-wrap gap-2 px-3 pt-3" aria-label="Adjuntos del comentario">
      {drafts.map((d) => (
        <li key={d.id} className="relative">
          <div
            className={cn(
              "relative grid size-16 place-items-center overflow-hidden rounded-lg border bg-muted",
              d.status === "error" && "border-destructive",
            )}
            title={d.error ?? d.name}
          >
            {d.kind === "image" ? (
              <img src={d.previewUrl} alt={d.name} className="size-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
                <Mic className="size-5" />
                {d.durationMs ? <span className="text-[10px] tabular-nums">{formatDuration(d.durationMs)}</span> : null}
              </div>
            )}
            {(d.status === "processing" || d.status === "uploading") && (
              <div className="absolute inset-x-1 bottom-1 h-1 overflow-hidden rounded-full bg-background/80">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${Math.max(5, d.progress * 100)}%` }}
                  role="progressbar"
                  aria-label={`Subiendo ${d.name}`}
                  aria-valuenow={Math.round(d.progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            )}
            {d.status === "error" && (
              <div className="absolute inset-0 grid place-items-center bg-destructive/10">
                <AlertCircle className="size-5 text-destructive" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onRemove(d.id)}
            className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
            aria-label={`Quitar ${d.name}`}
          >
            <X className="size-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}
