import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDuration, MAX_RECORDING_MS, recordingMimeType } from "../../lib/media";

type State = { step: "idle" } | { step: "recording"; startedAt: number } | { step: "preview"; blob: Blob; url: string; ms: number };

/**
 * Nota de voz con MediaRecorder: tiempo e indicador de nivel mientras graba,
 * vista previa antes de adjuntar y corte automático a los 10 minutos. El
 * formato es el que soporte el navegador (WebM en Chrome/Firefox, MP4 en Safari).
 */
export function AudioRecorder({ onRecorded, disabled }: { onRecorded: (blob: Blob, ms: number) => void; disabled?: boolean }) {
  const [state, setState] = useState<State>({ step: "idle" });
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number>();
  const discardOnStop = useRef(false);

  const cleanupStream = () => {
    cancelAnimationFrame(raf.current!);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close();
    audioCtx.current = null;
    setLevel(0);
  };

  // Al desmontar (cerrar el panel) a mitad de grabación: se descarta.
  useEffect(
    () => () => {
      discardOnStop.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      cleanupStream();
    },
    [],
  );

  useEffect(() => {
    if (state.step !== "recording") return;
    const t = setInterval(() => {
      const ms = Date.now() - state.startedAt;
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS) recorder.current?.stop();
    }, 250);
    return () => clearInterval(t);
  }, [state]);

  const start = async () => {
    const mimeType = recordingMimeType();
    if (!mimeType || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Tu navegador no permite grabar audio", { description: "Puedes adjuntar un archivo de audio en su lugar." });
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("No hay acceso al micrófono", {
        description: "Activa el micrófono en la configuración del navegador para grabar. Puedes adjuntar un archivo de audio.",
      });
      setOpen(false);
      return;
    }

    // Indicador de nivel (RMS del micrófono).
    try {
      audioCtx.current = new AudioContext();
      const analyser = audioCtx.current.createAnalyser();
      analyser.fftSize = 512;
      audioCtx.current.createMediaStreamSource(stream.current).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3));
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* sin indicador de nivel */
    }

    const chunks: Blob[] = [];
    const startedAt = Date.now();
    const rec = new MediaRecorder(stream.current, { mimeType });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      cleanupStream();
      const ms = Math.min(Date.now() - startedAt, MAX_RECORDING_MS);
      if (discardOnStop.current || !chunks.length) {
        discardOnStop.current = false;
        setState({ step: "idle" });
        return;
      }
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType });
      setState({ step: "preview", blob, url: URL.createObjectURL(blob), ms });
    };
    recorder.current = rec;
    rec.start(250);
    setElapsed(0);
    setState({ step: "recording", startedAt });
  };

  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const discard = () => {
    if (state.step === "recording") {
      discardOnStop.current = true;
      stop();
    }
    if (state.step === "preview") URL.revokeObjectURL(state.url);
    setState({ step: "idle" });
    setOpen(false);
  };

  const attach = () => {
    if (state.step !== "preview") return;
    onRecorded(state.blob, state.ms);
    URL.revokeObjectURL(state.url);
    setState({ step: "idle" });
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o && state.step !== "idle") return; // no cerrar a mitad de una grabación
        setOpen(o);
        if (o && state.step === "idle") void start();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" disabled={disabled} aria-label="Grabar nota de voz">
          <Mic className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3" onEscapeKeyDown={(e) => { e.preventDefault(); discard(); }}>
        {state.step === "recording" && (
          <>
            <div className="flex items-center gap-3">
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60" />
                <span className="relative inline-flex size-3 rounded-full bg-destructive" />
              </span>
              <span className="font-mono text-sm tabular-nums" aria-live="off">
                {formatDuration(elapsed)}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-primary transition-[width] duration-75" style={{ width: `${level * 100}%` }} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Grabando… se detiene sola a los 10 minutos.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={discard}>
                <Trash2 className="mr-1.5 size-3.5" /> Descartar
              </Button>
              <Button size="sm" onClick={stop}>
                <Square className="mr-1.5 size-3.5 fill-current" /> Detener
              </Button>
            </div>
          </>
        )}
        {state.step === "preview" && (
          <>
            <p className="text-sm font-medium">Nota de voz · {formatDuration(state.ms)}</p>
            <audio src={state.url} controls className="w-full" aria-label="Vista previa de la nota de voz" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={discard}>
                Descartar
              </Button>
              <Button size="sm" onClick={attach}>
                Adjuntar
              </Button>
            </div>
          </>
        )}
        {state.step === "idle" && <p className="text-sm text-muted-foreground">Pidiendo acceso al micrófono…</p>}
      </PopoverContent>
    </Popover>
  );
}
