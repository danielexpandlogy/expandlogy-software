import { useMemo, useState } from "react";
import { Crown, Eye, MoreHorizontal, Pause, Pencil, Play, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { LpSettings } from "@/lib/database.types";
import { credibleInterval, optionLetter, type Phase } from "@danielexpandlogy/landing-core";
import {
  useDeleteOption,
  useDeleteVariable,
  useResetVariable,
  useSaveOption,
  useSetOptionActive,
  useUpdateVariable,
  type LabOption,
  type LabVariable,
} from "../api";
import { OptionDialog, type OptionDraft } from "./OptionDialog";
import { OptionContent } from "./OptionContent";
import { useVariableAnalysis } from "./useVariableAnalysis";
import { num, pct, PHASE_BADGE, rate } from "./format";
import { sectionLabels as labelsOf, withParams } from "./links";

interface Props {
  landing: string;
  /** null mientras la landing no tiene dirección: no hay vista previa. */
  landingUrl: string | null;
  variable: LabVariable;
  settings: LpSettings;
  accent: string;
}

type Confirm = { type: "reset" } | { type: "delete"; option: LabOption } | { type: "deleteVariable" } | null;

export function VariableCard({ landing, landingUrl, variable, settings, accent }: Props) {
  const kind = variable.kind;
  const sectionLabels = useMemo(() => labelsOf(variable), [variable]);
  const updateVariable = useUpdateVariable(landing);
  const saveOption = useSaveOption(landing);
  const setActive = useSetOptionActive(landing);
  const deleteOption = useDeleteOption(landing);
  const resetVariable = useResetVariable(landing);
  const deleteVariable = useDeleteVariable(landing);
  const [editing, setEditing] = useState<OptionDraft | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const { active, winner, analysis, best, probOf, shareOf } = useVariableAnalysis(variable, settings);
  const intervals = useMemo(
    () => new Map(variable.options.map((o) => [o.id, o.stats.visitors ? credibleInterval({ id: o.id, ...o.stats }) : null])),
    [variable.options],
  );
  const control = variable.options.find((o) => o.is_control) ?? variable.options[0];
  const badge = PHASE_BADGE[analysis.phase];
  const phaseLabel = analysis.phase === "optimizing" && !settings.auto_optimize ? "Reparto parejo" : badge.label;

  const openNew = () =>
    setEditing({ label: "", value: structuredClone(control?.value ?? {}) });

  const save = (draft: OptionDraft) => {
    const position = Math.max(0, ...variable.options.map((o) => o.position)) + 1;
    saveOption.mutate(
      { ...draft, variable_id: variable.id, position },
      { onSuccess: () => setEditing(null) },
    );
  };

  const fixWinner = (optionId: string | null) => updateVariable.mutate({ id: variable.id, winner_option_id: optionId });

  return (
    <Card className="shadow-none">
      <CardHeader className="gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base font-semibold">{variable.name}</CardTitle>
            <Badge variant="outline" className={cn("border-transparent", badge.className)}>
              {phaseLabel}
            </Badge>
          </div>
          <CardDescription>{variable.description}</CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch
              checked={variable.enabled}
              onCheckedChange={(enabled) => updateVariable.mutate({ id: variable.id, enabled })}
              aria-label={`Probar ${variable.name}`}
            />
            En prueba
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="ml-1 size-8" aria-label={`Más acciones de ${variable.name}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <p className="px-2 py-1.5 font-mono text-xs text-muted-foreground">key: {variable.key}</p>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setConfirm({ type: "deleteVariable" })}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" /> Eliminar variable
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <PhaseDetail
          phase={analysis.phase}
          settings={settings}
          minVisitors={analysis.minVisitors}
          best={best}
          bestProb={analysis.probBest[analysis.bestIndex] ?? 0}
          winner={winner}
          onFix={() => best && fixWinner(best.id)}
          onUnfix={() => fixWinner(null)}
        />

        <div className="-mx-6 overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Opción</TableHead>
                <TableHead className="text-right">Visitantes</TableHead>
                <TableHead className="text-right">Clic en CTA</TableHead>
                <TableHead className="text-right">Agendas</TableHead>
                <TableHead className="text-right">Tasa de agenda</TableHead>
                <TableHead className="text-right">Prob. de ser la mejor</TableHead>
                <TableHead className="text-right">Tráfico</TableHead>
                <TableHead className="w-12 pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {variable.options.map((o, i) => {
                const prob = probOf(o);
                const share = shareOf(o);
                const interval = intervals.get(o.id);
                const isWinner = o.id === variable.winner_option_id;
                return (
                  <TableRow key={o.id} className={cn(!o.active && "text-muted-foreground")}>
                    <TableCell className="py-3.5 pl-6">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-secondary text-xs font-semibold text-foreground">
                          {optionLetter(i)}
                        </span>
                        <div className={cn("min-w-0 space-y-1.5", !o.active && "opacity-60")}>
                          <OptionContent kind={kind} value={o.value} sectionLabels={sectionLabels} accent={accent} />
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{o.label}</span>
                            {o.is_control && <Badge variant="outline" className="text-[10px]">Original</Badge>}
                            {!o.active && <Badge variant="secondary" className="text-[10px]">Pausada</Badge>}
                            {isWinner && <Crown className="size-3.5 text-success" aria-label="Ganadora" />}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{num(o.stats.visitors)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(o.stats.clicks)}
                      <span className="ml-1.5 text-xs text-muted-foreground">{rate(o.stats.clicks, o.stats.visitors)}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{num(o.stats.conversions)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="font-medium">{rate(o.stats.conversions, o.stats.visitors)}</span>
                      {interval && (
                        <span className="block text-xs text-muted-foreground">
                          {pct(interval[0])} – {pct(interval[1])}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {prob === null ? "—" : pct(prob, 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {share === null ? "—" : pct(share, 0)}
                    </TableCell>
                    <TableCell className="pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" aria-label={`Acciones de ${o.label}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {landingUrl && (
                            <DropdownMenuItem asChild>
                              <a href={withParams(landingUrl, { lp_preview: o.id })} target="_blank" rel="noreferrer">
                                <Eye className="mr-2 size-4" /> Vista previa
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => setEditing({ id: o.id, label: o.label, value: structuredClone(o.value), isControl: o.is_control })}>
                            <Pencil className="mr-2 size-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setActive.mutate({ id: o.id, active: !o.active })}>
                            {o.active ? <Pause className="mr-2 size-4" /> : <Play className="mr-2 size-4" />}
                            {o.active ? "Pausar" : "Reactivar"}
                          </DropdownMenuItem>
                          {!isWinner && (
                            <DropdownMenuItem onSelect={() => fixWinner(o.id)}>
                              <Crown className="mr-2 size-4" /> Fijar como ganadora
                            </DropdownMenuItem>
                          )}
                          {!o.is_control && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => setConfirm({ type: "delete", option: o })}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 size-4" /> Eliminar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={openNew}>
            <Plus className="mr-1.5 size-4" /> Agregar opción
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirm({ type: "reset" })} className="text-muted-foreground">
            <RotateCcw className="mr-1.5 size-4" /> Reiniciar datos
          </Button>
        </div>
      </CardContent>

      <OptionDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        variableName={variable.name}
        kind={kind}
        sectionLabels={sectionLabels}
        accent={accent}
        initial={editing ?? { label: "", value: {} }}
        saving={saveOption.isPending}
        onSave={save}
      />

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.type === "delete"
                ? `¿Eliminar «${confirm.option.label}»?`
                : confirm?.type === "deleteVariable"
                  ? `¿Eliminar la variable «${variable.name}»?`
                  : `¿Reiniciar los datos de «${variable.name}»?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === "delete"
                ? "Se borran la opción y sus resultados. Si sólo quieres dejar de mostrarla, mejor páusala."
                : confirm?.type === "deleteVariable"
                  ? "Se borran todas sus opciones y resultados, y la landing vuelve a mostrar su versión original. Si sólo quieres dejar de probarla, mejor apágala. No se puede deshacer."
                  : "Los visitantes, clics y agendas de todas sus opciones vuelven a cero y la prueba empieza desde la exploración. No se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirm?.type === "delete") deleteOption.mutate(confirm.option.id);
                else if (confirm?.type === "deleteVariable") deleteVariable.mutate(variable.id);
                else resetVariable.mutate(variable.id);
                setConfirm(null);
              }}
            >
              {confirm?.type === "reset" ? "Reiniciar" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Meter({ label, value, target, format }: { label: string; value: number; target: number; format: (n: number) => string }) {
  const progress = Math.min(100, (value / target) * 100);
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">
          {format(value)} <span className="text-muted-foreground">/ {format(target)}</span>
        </span>
      </div>
      <Progress value={progress} className={cn("h-1.5", progress >= 100 && "[&>div]:bg-success")} aria-label={label} />
    </div>
  );
}

function PhaseDetail({
  phase,
  settings,
  minVisitors,
  best,
  bestProb,
  winner,
  onFix,
  onUnfix,
}: {
  phase: Phase;
  settings: LpSettings;
  minVisitors: number;
  best?: LabOption;
  bestProb: number;
  winner?: LabOption;
  onFix: () => void;
  onUnfix: () => void;
}) {
  const box = "rounded-lg border bg-muted/40 p-4 text-sm";

  if (phase === "off") return <p className={box}>Apagada: todos los visitantes ven la versión original.</p>;
  if (phase === "single")
    return <p className={box}>Hacen falta al menos dos opciones activas para probar. Agrega o reactiva una.</p>;
  if (phase === "fixed")
    return (
      <div className={cn(box, "flex flex-wrap items-center justify-between gap-3")}>
        <p>
          Todos los visitantes ven <strong>«{winner?.label}»</strong>. No se registran datos nuevos de esta variable.
        </p>
        <Button variant="outline" size="sm" onClick={onUnfix}>
          <X className="mr-1.5 size-4" /> Quitar ganador y seguir probando
        </Button>
      </div>
    );

  const winRule = `${pct(settings.win_probability, 0)} de probabilidad y ${num(settings.min_conversions_to_win)} agendas`;

  return (
    <div className={cn(box, "space-y-4")}>
      {phase === "exploring" && (
        <p>
          Reparto parejo hasta que cada opción tenga {num(settings.min_visitors_per_option)} visitantes. Antes de eso, cualquier
          diferencia puede ser suerte.
        </p>
      )}
      {phase === "optimizing" && (
        <p>
          {settings.auto_optimize ? "La que va mejor recibe más tráfico" : "Autooptimización apagada: el tráfico se reparte parejo"}.
          Por ahora gana <strong>«{best?.label}»</strong>. Para declarar ganador necesita {winRule}.
        </p>
      )}
      {phase === "ready" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            <strong>«{best?.label}»</strong> ya cumple la regla ({winRule}). Puedes fijarla para que todos la vean y probar
            otra variable.
          </p>
          <Button size="sm" onClick={onFix}>
            <Crown className="mr-1.5 size-4" /> Fijar ganador
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row">
        <Meter label="Exploración (opción con menos visitantes)" value={minVisitors} target={settings.min_visitors_per_option} format={num} />
        <Meter label="Probabilidad de la mejor" value={bestProb} target={settings.win_probability} format={(n) => pct(n, 0)} />
        <Meter label="Agendas de la mejor" value={best?.stats.conversions ?? 0} target={settings.min_conversions_to_win} format={num} />
      </div>
    </div>
  );
}
