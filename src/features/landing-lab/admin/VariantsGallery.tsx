import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LpSettings } from "@/lib/database.types";
import { optionLetter } from "@danielexpandlogy/landing-core";
import type { LabOption, LabVariable } from "../api";
import { LivePreview } from "./LivePreview";
import { OptionContent } from "./OptionContent";
import { sectionLabels as labelsOf, withParams } from "./links";
import { useVariableAnalysis } from "./useVariableAnalysis";
import { pct, PHASE_BADGE, rate } from "./format";

/** Captura de una opción dibujada con los componentes de la landing (sólo landings dentro de esta app). */
export type RenderPreview = (variable: LabVariable, option: LabOption) => ReactNode;

interface Common {
  settings: LpSettings;
  landingUrl: string | null;
  accent: string;
  /** Sin esto se muestra la landing publicada en un iframe. */
  renderPreview?: RenderPreview;
}

function GalleryVariable({ variable, ...common }: Common & { variable: LabVariable }) {
  const { settings, landingUrl, accent, renderPreview } = common;
  const kind = variable.kind;
  const sectionLabels = labelsOf(variable);
  const { winner, analysis, shareOf } = useVariableAnalysis(variable, settings);
  const shown = winner ? [winner] : variable.options.filter((o) => o.active);
  const badge = PHASE_BADGE[analysis.phase];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{variable.name}</h3>
        <Badge variant="outline" className={cn("border-transparent", badge.className)}>
          {analysis.phase === "optimizing" && !settings.auto_optimize ? "Reparto parejo" : badge.label}
        </Badge>
      </div>
      <div className={cn("grid gap-4", shown.length > 1 && "md:grid-cols-2", shown.length > 2 && "xl:grid-cols-3")}>
        {shown.map((o) => {
          const share = shareOf(o);
          return (
            <figure key={o.id} className="flex flex-col gap-2.5 rounded-xl border bg-card p-3">
              <figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-secondary text-xs font-semibold">
                    {optionLetter(variable.options.indexOf(o))}
                  </span>
                  <span className="truncate font-medium">{o.label}</span>
                  {o.is_control && <Badge variant="outline" className="text-[10px]">Original</Badge>}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {share !== null && `${pct(share, 0)} del tráfico · `}
                  {rate(o.stats.conversions, o.stats.visitors)} agenda
                </span>
              </figcaption>
              {renderPreview ? (
                renderPreview(variable, o)
              ) : landingUrl ? (
                <LivePreview url={withParams(landingUrl, { lp_preview: o.id })} title={`${variable.name}: ${o.label}`} />
              ) : (
                <OptionContent kind={kind} value={o.value} sectionLabels={sectionLabels} accent={accent} />
              )}
              {kind === "order" && (renderPreview || landingUrl) && (
                <OptionContent kind={kind} value={o.value} sectionLabels={sectionLabels} accent={accent} />
              )}
              {landingUrl && (
                <a
                  href={withParams(landingUrl, { lp_preview: o.id })}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" /> Abrir en la landing
                </a>
              )}
            </figure>
          );
        })}
      </div>
    </section>
  );
}

/** Todas las variables encendidas, cada opción dibujada como captura de la landing. */
export function VariantsGallery({
  open,
  onOpenChange,
  variables,
  ...common
}: Common & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variables: LabVariable[];
}) {
  const enabled = variables.filter((v) => v.enabled);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[95vw] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Variantes en prueba</DialogTitle>
          <DialogDescription>
            Así se ve cada opción en la landing, con sólo esa variable cambiada. Las variables con ganador fijado muestran sólo
            la ganadora.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <div className="space-y-8 pt-2">
            {enabled.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay variables encendidas: todos ven la landing original.</p>
            ) : (
              enabled.map((v) => <GalleryVariable key={v.id} variable={v} {...common} />)
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
