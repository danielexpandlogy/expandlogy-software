import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { validateValue, VARIABLE_KINDS, type VariableKind } from "@danielexpandlogy/landing-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCreateVariable } from "../api";
import { ValueEditor } from "./OptionDialog";
import { emptyValue, KIND_LABELS } from "./format";
import { slugify } from "./links";

const KEY = /^[a-z0-9_]{1,40}$/;
const SECTION_KEY = /^[A-Za-z0-9_-]{1,40}$/;

/** "signs = Señales de alerta" por línea → secciones; null si alguna línea no sirve. */
function parseSections(text: string): { key: string; label: string }[] | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const sections = lines.map((line) => {
    const [key, ...rest] = line.split("=");
    return { key: key.trim(), label: rest.join("=").trim() || key.trim() };
  });
  const keys = sections.map((s) => s.key);
  if (sections.length < 2 || sections.some((s) => !SECTION_KEY.test(s.key)) || new Set(keys).size !== keys.length) return null;
  return sections;
}

/**
 * Nueva variable con su opción original: lo que la landing muestra hoy. La
 * `key` tiene que ser la misma que usa el código de la landing para aplicarla.
 */
export function NewVariableDialog({
  open,
  onOpenChange,
  landing,
  accent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  landing: string;
  accent: string;
}) {
  const create = useCreateVariable(landing);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [kind, setKind] = useState<VariableKind>("headline");
  const [description, setDescription] = useState("");
  const [sectionsText, setSectionsText] = useState("");
  const [value, setValue] = useState<Record<string, unknown>>(() => emptyValue("headline", accent, []));
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo(() => (kind === "order" ? parseSections(sectionsText) : null), [kind, sectionsText]);
  const sectionKeys = useMemo(() => sections?.map((s) => s.key) ?? [], [sections]);
  const labels = useMemo(() => Object.fromEntries((sections ?? []).map((s) => [s.key, s.label])), [sections]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setKey("");
    setKeyTouched(false);
    setKind("headline");
    setDescription("");
    setSectionsText("");
    setValue(emptyValue("headline", accent, []));
    setError(null);
  }, [open, accent]);

  // El orden original sigue a la lista de secciones mientras se escribe.
  useEffect(() => {
    if (kind === "order") setValue({ order: sectionKeys });
  }, [kind, sectionKeys]);

  const changeKind = (next: VariableKind) => {
    setKind(next);
    setValue(emptyValue(next, accent, sectionKeys));
    setError(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Ponle un nombre a la variable.");
    if (!KEY.test(key)) return setError("La key sólo puede tener minúsculas, números y _ (máximo 40).");
    if (kind === "order" && !sections)
      return setError("Escribe al menos dos secciones, una por línea, como key = Nombre (sin keys repetidas).");
    const problem = validateValue(kind, value, sectionKeys);
    if (problem) return setError(`Opción original: ${problem}`);
    setError(null);
    create.mutate(
      {
        key,
        name: name.trim(),
        kind,
        description: description.trim(),
        config: kind === "order" && sections ? { sections } : {},
        controlLabel: "Original",
        controlValue: value,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Nueva variable</DialogTitle>
            <DialogDescription>
              Se crea apagada. La landing tiene que aplicar esta key en su código (ver el README de landing-core).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="nv-name">Nombre</Label>
            <Input
              id="nv-name"
              maxLength={80}
              placeholder="Titular del hero"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!keyTouched) setKey(slugify(e.target.value, "_"));
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nv-key">Key</Label>
              <Input
                id="nv-key"
                className="font-mono"
                maxLength={40}
                value={key}
                onChange={(e) => {
                  setKeyTouched(true);
                  setKey(e.target.value.toLowerCase());
                }}
              />
              <p className="text-xs text-muted-foreground">La que usa el código de la landing.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nv-kind">Tipo</Label>
              <Select value={kind} onValueChange={(v) => changeKind(v as VariableKind)}>
                <SelectTrigger id="nv-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VARIABLE_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABELS[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{KIND_LABELS[kind].hint}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nv-desc">Descripción (opcional)</Label>
            <Input id="nv-desc" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {kind === "order" && (
            <div className="space-y-1.5">
              <Label htmlFor="nv-sections">Secciones, en el orden original</Label>
              <Textarea
                id="nv-sections"
                rows={5}
                className="font-mono text-xs"
                placeholder={"services = Servicios\ntestimonials = Reseñas\nfaq = Preguntas frecuentes"}
                value={sectionsText}
                onChange={(e) => setSectionsText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Una por línea: la key del código = el nombre que se ve en el panel.</p>
            </div>
          )}

          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Opción original</p>
            <p className="-mt-2 text-xs text-muted-foreground">Lo que muestra hoy la landing. Contra esto se comparan las demás.</p>
            {(kind !== "order" || sections) && (
              <ValueEditor kind={kind} value={value} onChange={setValue} sectionLabels={labels} accent={accent} />
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Crear variable
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
