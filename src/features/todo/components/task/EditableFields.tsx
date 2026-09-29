import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Textarea que crece con el contenido. */
function useAutosize(ref: React.RefObject<HTMLTextAreaElement>, value: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value]);
}

/** Título editable en línea. Vacío → vuelve al valor anterior. Enter guarda. */
export function EditableTitle({
  value,
  onSave,
  completed,
}: {
  value: string;
  onSave: (title: string) => void;
  completed?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutosize(ref, draft);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const next = draft.trim().replace(/\s+/g, " ");
    if (!next) return setDraft(value);
    if (next !== value) onSave(next);
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      value={draft}
      maxLength={500}
      aria-label="Título de la tarea"
      onChange={(e) => setDraft(e.target.value.replace(/\n/g, ""))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          // Esc cancela la edición sin cerrar el panel.
          e.stopPropagation();
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      onBlur={commit}
      className={cn(
        "keep-font-size w-full resize-none overflow-hidden rounded-md bg-transparent px-1 py-0.5 text-xl font-semibold leading-snug tracking-tight outline-none",
        "hover:bg-muted/60 focus:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
        completed && "text-muted-foreground line-through",
      )}
    />
  );
}

type SaveState = "idle" | "saving" | "saved";

/**
 * Descripción con autoguardado: debounce de 800 ms mientras se escribe, guardado
 * inmediato al perder el foco y "flush" al desmontar (cerrar el panel justo
 * después de escribir no pierde texto).
 */
export function DescriptionEditor({ value, onSave }: { value: string; onSave: (text: string) => Promise<unknown> }) {
  const [draft, setDraft] = useState(value);
  const [state, setState] = useState<SaveState>("idle");
  const ref = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef({ draft: value, saved: value });
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  useAutosize(ref, draft);

  // Cambios externos (otra pestaña, Realtime) sólo si no hay edición pendiente.
  useEffect(() => {
    if (latest.current.draft === latest.current.saved) {
      setDraft(value);
      latest.current = { draft: value, saved: value };
    }
  }, [value]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const { draft: text, saved } = latest.current;
    if (text === saved) return;
    latest.current.saved = text;
    setState("saving");
    onSaveRef.current(text).then(
      () => setState("saved"),
      () => setState("idle"),
    );
  }, []);

  useEffect(() => () => flush(), [flush]);

  return (
    <div className="space-y-1">
      <textarea
        ref={ref}
        value={draft}
        rows={3}
        maxLength={20000}
        placeholder="Añade una descripción…"
        aria-label="Descripción"
        onChange={(e) => {
          setDraft(e.target.value);
          latest.current.draft = e.target.value;
          clearTimeout(timer.current);
          timer.current = setTimeout(flush, 800);
        }}
        onBlur={flush}
        className="min-h-20 w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm leading-relaxed outline-none hover:border-border focus:border-border focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p className="flex h-4 items-center gap-1 px-2 text-xs text-muted-foreground" aria-live="polite">
        {state === "saving" && (
          <>
            <Loader2 className="size-3 animate-spin" /> Guardando…
          </>
        )}
        {state === "saved" && (
          <>
            <Check className="size-3" /> Guardado
          </>
        )}
      </p>
    </div>
  );
}
