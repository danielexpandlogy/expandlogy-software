import { useEffect, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HEX_COLOR, validateValue, type VariableKind } from "@danielexpandlogy/landing-core";

type Value = Record<string, unknown>;

export interface OptionDraft {
  id?: string;
  label: string;
  value: Value;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variableName: string;
  kind: VariableKind;
  sectionLabels: Record<string, string>;
  accent: string;
  initial: OptionDraft;
  saving: boolean;
  onSave: (draft: OptionDraft) => void;
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

function Field({ id, label, hint, ...props }: { id: string; label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Formulario del valor de una opción según el tipo de la variable. */
export function ValueEditor({
  kind,
  value,
  onChange,
  sectionLabels,
  accent,
}: {
  kind: VariableKind;
  value: Value;
  onChange: (value: Value) => void;
  sectionLabels: Record<string, string>;
  accent: string;
}) {
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });

  switch (kind) {
    case "headline":
      return (
        <div className="space-y-3">
          <Field id="h-before" label="Texto antes" value={text(value.before)} onChange={(e) => set("before", e.target.value)} />
          <Field
            id="h-highlight"
            label="Texto resaltado (con el color de marca)"
            value={text(value.highlight)}
            onChange={(e) => set("highlight", e.target.value)}
          />
          <Field id="h-after" label="Texto después" value={text(value.after)} onChange={(e) => set("after", e.target.value)} />
          <div className="rounded-lg bg-[#15130f] px-4 py-3 text-lg font-extrabold leading-tight text-white">
            {text(value.before)}
            <span style={{ color: accent }}>{text(value.highlight)}</span>
            {text(value.after)}
          </div>
        </div>
      );
    case "text":
      return (
        <div className="space-y-1.5">
          <Label htmlFor="t-text">Texto</Label>
          <Textarea id="t-text" rows={4} maxLength={2000} value={text(value.text)} onChange={(e) => set("text", e.target.value)} />
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          <Field
            id="i-src"
            label="URL de la imagen"
            placeholder="https://…"
            value={text(value.src)}
            onChange={(e) => set("src", e.target.value.trim())}
          />
          <Field
            id="i-alt"
            label="Texto alternativo"
            hint="Describe lo que se ve; lo leen los lectores de pantalla."
            value={text(value.alt)}
            onChange={(e) => set("alt", e.target.value)}
          />
          {/^https:\/\//.test(text(value.src)) && (
            <img src={text(value.src)} alt="" className="max-h-48 w-full rounded-lg border object-cover" />
          )}
        </div>
      );
    case "cta":
      return (
        <div className="space-y-3">
          <Field id="c-label" label="Texto del botón" maxLength={60} value={text(value.label)} onChange={(e) => set("label", e.target.value)} />
          <Field id="c-sub" label="Subtítulo" maxLength={80} value={text(value.sub)} onChange={(e) => set("sub", e.target.value)} />
          <div className="flex flex-col items-center rounded-xl px-6 py-4 text-white" style={{ background: accent }}>
            <span className="font-bold">▶ {text(value.label) || "…"}</span>
            {text(value.sub) && (
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider opacity-85">{text(value.sub)}</span>
            )}
          </div>
        </div>
      );
    case "color": {
      const color = text(value.color);
      const hover = text(value.hover);
      return (
        <div className="space-y-3">
          {(
            [
              ["color", "Color del botón", color],
              ["hover", "Color al pasar el mouse", hover],
            ] as const
          ).map(([key, label, current]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`k-${key}`}>{label}</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label={label}
                  value={HEX_COLOR.test(current) ? current : "#000000"}
                  onChange={(e) => set(key, e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-md border bg-background p-1"
                />
                <Input id={`k-${key}`} value={current} onChange={(e) => set(key, e.target.value.trim())} className="font-mono" />
              </div>
            </div>
          ))}
          <div
            className="rounded-xl px-6 py-4 text-center font-bold text-white"
            style={{ background: HEX_COLOR.test(color) ? color : "#999" }}
          >
            ▶ Botón
          </div>
        </div>
      );
    }
    case "order": {
      const order = Array.isArray(value.order) ? (value.order as string[]) : Object.keys(sectionLabels);
      const move = (i: number, dir: -1 | 1) => {
        const next = [...order];
        [next[i], next[i + dir]] = [next[i + dir], next[i]];
        set("order", next);
      };
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">El hero siempre va primero y el pie de página al final.</p>
          <ol className="divide-y rounded-lg border">
            {order.map((key, i) => (
              <li key={key} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-5 text-right tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="flex-1 font-medium">{sectionLabels[key] ?? key}</span>
                <Button type="button" variant="ghost" size="icon" className="size-8" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${sectionLabels[key] ?? key}`}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={i === order.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Bajar ${sectionLabels[key] ?? key}`}
                >
                  <ArrowDown className="size-4" />
                </Button>
              </li>
            ))}
          </ol>
        </div>
      );
    }
  }
}

export function OptionDialog({ open, onOpenChange, variableName, kind, sectionLabels, accent, initial, saving, onSave }: Props) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setError(null);
    }
  }, [open, initial]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.label.trim()) return setError("Ponle un nombre a la opción.");
    const problem = validateValue(kind, draft.value, Object.keys(sectionLabels));
    if (problem) return setError(problem);
    onSave({ ...draft, label: draft.label.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{initial.id ? "Editar opción" : "Nueva opción"}</DialogTitle>
            <DialogDescription>{variableName}. Escribe el contenido en el idioma de la landing.</DialogDescription>
          </DialogHeader>
          <Field
            id="opt-label"
            label="Nombre interno"
            hint="Sólo se ve en este panel."
            maxLength={80}
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
          <ValueEditor
            kind={kind}
            value={draft.value}
            onChange={(value) => setDraft({ ...draft, value })}
            sectionLabels={sectionLabels}
            accent={accent}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {initial.id && (
            <p className="text-xs text-muted-foreground">
              Si cambias mucho el contenido, conviene reiniciar los datos de la variable: los resultados anteriores eran de la versión vieja.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
