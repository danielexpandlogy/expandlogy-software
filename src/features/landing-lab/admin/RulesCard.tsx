import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LpSettings } from "@/lib/database.types";
import { visitorsPerOption } from "@danielexpandlogy/landing-core";
import { useUpdateSettings, type LabData } from "../api";
import { num } from "./format";

interface Form {
  auto_optimize: boolean;
  min_visitors_per_option: string;
  min_conversions_to_win: string;
  win_probability: string;
  traffic_floor: string;
}

const toForm = (s: LpSettings): Form => ({
  auto_optimize: s.auto_optimize,
  min_visitors_per_option: String(s.min_visitors_per_option),
  min_conversions_to_win: String(s.min_conversions_to_win),
  win_probability: String(Math.round(s.win_probability * 1000) / 10),
  traffic_floor: String(Math.round(s.traffic_floor * 1000) / 10),
});

function NumberField({
  id,
  label,
  hint,
  suffix,
  ...props
}: { id: string; label: string; hint: string; suffix?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type="number" inputMode="decimal" className={suffix ? "pr-8" : undefined} {...props} />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function RulesCard({ landing, settings }: { landing: string; settings: LpSettings }) {
  const update = useUpdateSettings(landing);
  const [form, setForm] = useState<Form>(() => toForm(settings));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setForm(toForm(settings)), [settings]);

  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(settings));
  const set = (key: keyof Form, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const minVisitors = Number(form.min_visitors_per_option);
    const minConversions = Number(form.min_conversions_to_win);
    const winProbability = Number(form.win_probability) / 100;
    const floor = Number(form.traffic_floor) / 100;
    if (!Number.isInteger(minVisitors) || minVisitors < 1) return setError("Las visitas mínimas deben ser un número entero mayor a 0.");
    if (!Number.isInteger(minConversions) || minConversions < 1) return setError("Las agendas mínimas deben ser un número entero mayor a 0.");
    if (!(winProbability >= 0.5 && winProbability <= 0.999)) return setError("La probabilidad para ganar debe estar entre 50% y 99.9%.");
    if (!(floor >= 0 && floor <= 0.5)) return setError("El tráfico mínimo debe estar entre 0% y 50%.");
    setError(null);
    update.mutate({
      auto_optimize: form.auto_optimize,
      min_visitors_per_option: minVisitors,
      min_conversions_to_win: minConversions,
      win_probability: winProbability,
      traffic_floor: floor,
    });
  };

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Reglas del algoritmo</CardTitle>
        <CardDescription>Aplican a todas las variables. Los cambios llegan a la landing en la siguiente visita.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-6">
          <label className="flex items-start gap-3 rounded-lg border p-4">
            <Switch checked={form.auto_optimize} onCheckedChange={(v) => set("auto_optimize", v)} className="mt-0.5" />
            <span className="space-y-1">
              <span className="block text-sm font-medium">Priorizar automáticamente a las mejores opciones</span>
              <span className="block text-xs text-muted-foreground">
                Apagado, el tráfico se reparte siempre parejo (A/B clásico) y sólo tú decides cuándo fijar un ganador.
              </span>
            </span>
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField
              id="r-min-visitors"
              label="Visitantes por opción antes de priorizar"
              hint="Mientras alguna opción tenga menos, el reparto es parejo."
              min={1}
              step={1}
              value={form.min_visitors_per_option}
              onChange={(e) => set("min_visitors_per_option", e.target.value)}
            />
            <NumberField
              id="r-floor"
              label="Tráfico mínimo por opción"
              hint="Ninguna opción activa baja de esto mientras se prioriza."
              suffix="%"
              min={0}
              max={50}
              step={1}
              value={form.traffic_floor}
              onChange={(e) => set("traffic_floor", e.target.value)}
            />
            <NumberField
              id="r-win-prob"
              label="Probabilidad para declarar ganador"
              hint="Qué tan segura debe ser la ventaja de la mejor opción."
              suffix="%"
              min={50}
              max={99.9}
              step={0.1}
              value={form.win_probability}
              onChange={(e) => set("win_probability", e.target.value)}
            />
            <NumberField
              id="r-min-conv"
              label="Agendas mínimas para declarar ganador"
              hint="Evita declarar ganador con muy pocos datos."
              min={1}
              step={1}
              value={form.min_conversions_to_win}
              onChange={(e) => set("min_conversions_to_win", e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={!dirty || update.isPending}>
              {update.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Guardar reglas
            </Button>
            {dirty && (
              <Button type="button" variant="ghost" onClick={() => setForm(toForm(settings))}>
                Descartar cambios
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const LIFTS = [0.2, 0.3, 0.5, 1];

/** ¿Cuántas visitas hacen falta? Con la tasa real de la landing si ya hay datos. */
export function SampleSizeCard({ totals }: { totals: LabData["totals"] }) {
  const observed = totals.visitors >= 200 && totals.conversions >= 5 ? totals.conversions / totals.visitors : null;
  const [baseRate, setBaseRate] = useState(() => String(observed ? Math.round(observed * 1000) / 10 : 5));
  const [lift, setLift] = useState("0.5");
  const [optionsCount, setOptionsCount] = useState("2");

  const p = Number(baseRate) / 100;
  const perOption = visitorsPerOption(p, Number(lift));
  const total = perOption * Number(optionsCount);
  const weekly = totals.visitors_7d;
  const weeks = Number.isFinite(total) && weekly > 0 ? Math.ceil(total / weekly) : null;

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base font-semibold">¿Cuántas visitas hacen falta?</CardTitle>
        <CardDescription>
          Visitas para detectar una mejora con 95% de confianza. Todas las variables se prueban a la vez con las mismas visitas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-rate">Tasa de agenda actual</Label>
            <div className="relative">
              <Input id="s-rate" type="number" min={0.1} max={50} step={0.1} value={baseRate} onChange={(e) => setBaseRate(e.target.value)} className="pr-8" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {observed ? `La landing lleva ${(observed * 100).toFixed(1)}%.` : "Aún sin datos suficientes: 5% es típico."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Mejora que quieres detectar</Label>
            <Select value={lift} onValueChange={setLift}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIFTS.map((l) => (
                  <SelectItem key={l} value={String(l)}>
                    +{l * 100}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Opciones en la variable</Label>
            <Select value={optionsCount} onValueChange={setOptionsCount}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} opciones
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {Number.isFinite(perOption) ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Visitantes por opción" value={num(perOption)} />
            <Stat label="Visitantes en total" value={num(total)} />
            <Stat
              label="Tiempo estimado"
              value={weeks ? `~${num(weeks)} ${weeks === 1 ? "semana" : "semanas"}` : "—"}
              hint={weekly > 0 ? `Con ${num(weekly)} visitantes en los últimos 7 días` : "Aún no hay visitas esta semana"}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Revisa la tasa: debe ser mayor a 0 y la mejora no puede pasar del 100%.</p>
        )}

        <p className="text-xs text-muted-foreground">
          Diferencias chicas (+20%) tardan mucho en confirmarse; por eso conviene probar cambios grandes (titulares o imágenes
          muy distintos) y pocas opciones a la vez.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
