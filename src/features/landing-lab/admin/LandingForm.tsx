import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { HEX_COLOR } from "@danielexpandlogy/landing-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "./links";

export interface LandingFields {
  landing: string;
  name: string;
  landing_url: string;
  thanks_url: string;
  accent_color: string;
}

const SLUG = /^[a-z0-9-]{1,40}$/;
const URL_OK = /^(https:\/\/|\/)\S*$/;

export interface LandingInput {
  landing: string;
  name: string;
  landing_url: string | null;
  thanks_url: string | null;
  accent_color: string;
}

function validate(f: LandingFields): string | LandingInput {
  if (!f.name.trim()) return "Ponle un nombre a la landing.";
  if (!SLUG.test(f.landing)) return "El identificador sólo puede tener minúsculas, números y guiones (máximo 40).";
  for (const [label, url] of [["de la landing", f.landing_url], ["de gracias", f.thanks_url]] as const) {
    if (url.trim() && !URL_OK.test(url.trim())) return `La URL ${label} debe empezar con https:// (o con / si vive en esta app).`;
  }
  if (!HEX_COLOR.test(f.accent_color)) return "El color debe tener el formato #RRGGBB.";
  return {
    landing: f.landing,
    name: f.name.trim(),
    landing_url: f.landing_url.trim().replace(/\/+$/, "") || null,
    thanks_url: f.thanks_url.trim() || null,
    accent_color: f.accent_color,
  };
}

/** Nombre, identificador, URLs y color de una landing. El identificador no cambia después de crearla. */
export function LandingForm({
  initial,
  isNew,
  saving,
  submitLabel,
  onSubmit,
  footer,
}: {
  initial: LandingFields;
  isNew: boolean;
  saving: boolean;
  submitLabel: string;
  onSubmit: (input: LandingInput) => void;
  footer?: ReactNode;
}) {
  const [form, setForm] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setForm(initial), [initial]);

  const set = (key: keyof LandingFields, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = validate(form);
    if (typeof result === "string") return setError(result);
    setError(null);
    onSubmit(result);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lf-name">Nombre</Label>
          <Input
            id="lf-name"
            maxLength={80}
            placeholder="Luqman"
            value={form.name}
            onChange={(e) => {
              set("name", e.target.value);
              if (!slugTouched) set("landing", slugify(e.target.value));
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lf-slug">Identificador</Label>
          <Input
            id="lf-slug"
            className="font-mono"
            maxLength={40}
            disabled={!isNew}
            value={form.landing}
            onChange={(e) => {
              setSlugTouched(true);
              set("landing", e.target.value.toLowerCase());
            }}
          />
          <p className="text-xs text-muted-foreground">
            {isNew ? "El que usa el código de la landing. No se puede cambiar después." : "El que usa el código de la landing."}
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lf-url">URL de la landing</Label>
        <Input
          id="lf-url"
          placeholder="https://luqman.com"
          value={form.landing_url}
          onChange={(e) => set("landing_url", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Para las vistas previas. Mientras no tenga dominio, usa la URL de Vercel. Puedes dejarla vacía por ahora.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lf-thanks">URL de la página de gracias</Label>
        <Input
          id="lf-thanks"
          placeholder="https://luqman.com/gracias"
          value={form.thanks_url}
          onChange={(e) => set("thanks_url", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">A donde redirige el calendario o formulario al agendar: ahí se cuenta la agenda.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lf-accent">Color de marca</Label>
        <div className="flex gap-2">
          <input
            type="color"
            aria-label="Color de marca"
            value={HEX_COLOR.test(form.accent_color) ? form.accent_color : "#000000"}
            onChange={(e) => set("accent_color", e.target.value)}
            className="h-10 w-12 cursor-pointer rounded-md border bg-background p-1"
          />
          <Input id="lf-accent" className="max-w-40 font-mono" value={form.accent_color} onChange={(e) => set("accent_color", e.target.value.trim())} />
        </div>
        <p className="text-xs text-muted-foreground">Sólo para dibujar titulares y botones en este panel.</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {footer}
        <Button type="submit" disabled={saving || (!isNew && !dirty)}>
          {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
