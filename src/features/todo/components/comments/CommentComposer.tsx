import { useRef, useState, type ReactNode } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX = 5000;
const WARN_AT = 4500;

// En táctil no hay Shift+Enter cómodo: Enter hace salto de línea y se envía con el botón.
const isCoarsePointer = () => {
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
};

interface Props {
  onSubmit: (body: string) => void;
  /** true si hay adjuntos listos: permite enviar sin texto (Sprint 6). */
  hasAttachments?: boolean;
  /** Bloquea el envío (p. ej. subidas en curso). */
  busy?: boolean;
  /** Controles extra (adjuntar, grabar) y vista previa de adjuntos. */
  tools?: ReactNode;
  preview?: ReactNode;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
}

export function CommentComposer({ onSubmit, hasAttachments, busy, tools, preview, onPaste }: Props) {
  const [body, setBody] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = (!!body.trim() || !!hasAttachments) && !busy && body.length <= MAX;

  const submit = () => {
    if (!canSend) return;
    onSubmit(body.trim());
    setBody("");
    requestAnimationFrame(() => {
      if (ref.current) ref.current.style.height = "auto";
    });
  };

  return (
    <div className="rounded-xl border bg-card focus-within:ring-2 focus-within:ring-ring">
      {preview}
      <textarea
        ref={ref}
        value={body}
        rows={1}
        maxLength={MAX}
        placeholder="Escribe un comentario…"
        aria-label="Escribe un comentario"
        onChange={(e) => {
          setBody(e.target.value);
          // Crece hasta ~8 líneas y luego hace scroll.
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 8 * 24)}px`;
        }}
        onPaste={onPaste}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !isCoarsePointer()) {
            e.preventDefault();
            submit();
          }
        }}
        className="block max-h-48 min-h-10 w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none"
      />
      <div className="flex items-center gap-1 px-2 pb-2">
        {tools}
        {body.length >= WARN_AT && (
          <span className={cn("ml-auto text-xs tabular-nums text-muted-foreground", body.length >= MAX && "text-destructive")}>
            {body.length}/{MAX}
          </span>
        )}
        <Button
          size="sm"
          className={cn("h-8 gap-1.5", body.length < WARN_AT && "ml-auto")}
          onClick={submit}
          disabled={!canSend}
        >
          <SendHorizontal className="size-3.5" /> Enviar
        </Button>
      </div>
    </div>
  );
}
