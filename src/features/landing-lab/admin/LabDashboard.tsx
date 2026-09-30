import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Images, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LpSettings } from "@/lib/database.types";
import { useLabData, useUpdateSettings } from "../api";
import { VariableCard } from "./VariableCard";
import { RulesCard, SampleSizeCard } from "./RulesCard";
import { num, rate } from "./format";
import { VariantsGallery, type RenderPreview } from "./VariantsGallery";
import { NewVariableDialog } from "./NewVariableDialog";
import { LandingForm, type LandingFields } from "./LandingForm";
import { absoluteUrl, withParams } from "./links";

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-5">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function CopyUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2 py-1 font-mono text-xs hover:bg-secondary"
    >
      <span className="truncate">{url}</span>
      {copied ? <Check className="size-3.5 shrink-0 text-success" /> : <Copy className="size-3.5 shrink-0" />}
    </button>
  );
}

function LandingTab({ settings }: { settings: LpSettings }) {
  const update = useUpdateSettings(settings.landing);
  const initial = useMemo<LandingFields>(
    () => ({
      landing: settings.landing,
      name: settings.name,
      landing_url: settings.landing_url ?? "",
      thanks_url: settings.thanks_url ?? "",
      accent_color: settings.accent_color,
    }),
    [settings],
  );

  return (
    <>
      <Card className="shadow-none">
        <CardContent className="p-5">
          <p className="mb-4 font-medium">Datos de la landing</p>
          <LandingForm
            initial={initial}
            isNew={false}
            saving={update.isPending}
            submitLabel="Guardar"
            onSubmit={({ landing, ...patch }) => update.mutate(patch)}
          />
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardContent className="space-y-3 p-5 text-sm">
          <p className="font-medium">Cómo se conecta la landing</p>
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>
              El repo de la landing instala <code className="rounded bg-muted px-1 py-0.5 text-xs">@danielexpandlogy/landing-core</code> y
              usa el identificador <code className="rounded bg-muted px-1 py-0.5 text-xs">{settings.landing}</code>.
            </li>
            <li>Cada variable se aplica en el código de la landing por su key (se ve en el menú ⋯ de cada variable).</li>
            <li>El calendario o formulario redirige a la página de gracias, que registra la agenda.</li>
            {settings.landing_url?.startsWith("https://") && (
              <li>
                Para que tus visitas no cuenten, abre una vez en cada navegador del equipo{" "}
                <CopyUrl url={withParams(settings.landing_url, { lp_team: "1" })} /> (con{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">lp_team=0</code> se deshace).
              </li>
            )}
          </ol>
        </CardContent>
      </Card>
    </>
  );
}

/** Panel de una landing: resultados, variables, reglas y sus datos. */
export function LabDashboard({ landing, renderPreview }: { landing: string; renderPreview?: RenderPreview }) {
  const { data, isLoading, error } = useLabData(landing);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [newVariableOpen, setNewVariableOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error || !data) {
    const notFound = error && "code" in error && error.code === "PGRST116";
    const missing = error && /lp_|schema cache|does not exist|column/i.test(error.message);
    return (
      <Card className="shadow-none">
        <CardContent className="space-y-2 p-6 text-sm">
          <p className="font-medium text-destructive">No se pudo cargar el panel.</p>
          <p className="text-muted-foreground">
            {notFound
              ? `No existe la landing «${landing}».`
              : missing
                ? "Falta aplicar las migraciones del Landing Lab (supabase/migrations/*landing_lab*.sql) en el SQL Editor de Supabase."
                : error?.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { settings, variables, totals } = data;
  const testing = variables.filter((v) => v.enabled && !v.winner_option_id).length;
  const { landing_url: landingUrl, thanks_url: thanksUrl, accent_color: accent } = settings;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{settings.name || settings.landing}</h2>
          <p className="text-sm text-muted-foreground">
            Cada variable se prueba por separado con las mismas visitas; la landing prioriza sola a las opciones que más agendan.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" onClick={() => setGalleryOpen(true)} disabled={variables.length === 0}>
            <Images className="mr-1.5 size-4" /> Ver variantes
          </Button>
          {landingUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={absoluteUrl(landingUrl)} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 size-4" /> Landing
              </a>
            </Button>
          )}
          {thanksUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={absoluteUrl(thanksUrl)} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 size-4" /> Gracias
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Visitantes" value={num(totals.visitors)} detail={`${num(totals.visitors_7d)} en los últimos 7 días`} />
        <Kpi label="Clics en CTA" value={num(totals.clicks)} detail={`${rate(totals.clicks, totals.visitors)} de los visitantes`} />
        <Kpi
          label="Agendas"
          value={num(totals.conversions)}
          detail={`${rate(totals.conversions, totals.visitors)} de los visitantes · ${num(totals.conversions_7d)} esta semana`}
        />
        <Kpi label="Variables en prueba" value={`${testing} de ${variables.length}`} detail="Encendidas y sin ganador fijado" />
      </div>

      <Card className="shadow-none">
        <CardContent className="space-y-2 p-5 text-sm">
          {thanksUrl ? (
            <p>
              <span className="font-medium">Calendario o formulario:</span> configura como URL de redirección al agendar{" "}
              <CopyUrl url={absoluteUrl(thanksUrl)} />
            </p>
          ) : (
            <p>
              <span className="font-medium">Falta la página de gracias:</span> agrégala en la pestaña Landing para poder contar las
              agendas.
            </p>
          )}
          <p className="text-muted-foreground">
            Las vistas previas y los navegadores del equipo no se cuentan. Para probar el flujo completo, usa una ventana de incógnito.
          </p>
        </CardContent>
      </Card>

      <VariantsGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        variables={variables}
        settings={settings}
        landingUrl={landingUrl}
        accent={accent}
        renderPreview={renderPreview}
      />
      <NewVariableDialog open={newVariableOpen} onOpenChange={setNewVariableOpen} landing={landing} accent={accent} />

      <Tabs defaultValue={variables.length ? "variables" : "landing"}>
        <TabsList>
          <TabsTrigger value="variables">Variables</TabsTrigger>
          <TabsTrigger value="rules">Reglas y umbrales</TabsTrigger>
          <TabsTrigger value="landing">Landing</TabsTrigger>
        </TabsList>
        <TabsContent value="variables" className="mt-4 space-y-4">
          {variables.length === 0 && (
            <Card className="shadow-none">
              <CardContent className="p-6 text-sm text-muted-foreground">
                Todavía no hay variables. Crea una por cada parte de la landing que quieras probar (titular, imagen, botón…).
              </CardContent>
            </Card>
          )}
          {variables.map((v) => (
            <VariableCard key={v.id} landing={landing} landingUrl={landingUrl} variable={v} settings={settings} accent={accent} />
          ))}
          <Button variant="outline" onClick={() => setNewVariableOpen(true)}>
            <Plus className="mr-1.5 size-4" /> Nueva variable
          </Button>
        </TabsContent>
        <TabsContent value="rules" className="mt-4 space-y-4">
          <Card className="shadow-none">
            <CardContent className="space-y-3 p-5 text-sm">
              <p className="font-medium">Cómo decide la landing</p>
              <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
                <li>
                  <span className="text-foreground">Explorando:</span> reparto parejo hasta que cada opción tenga{" "}
                  {num(settings.min_visitors_per_option)} visitantes.
                </li>
                <li>
                  <span className="text-foreground">Priorizando:</span> cada opción recibe tráfico según su probabilidad de ser la
                  mejor, sin bajar del {Math.round(settings.traffic_floor * 100)}%.
                </li>
                <li>
                  <span className="text-foreground">Ganador listo:</span> la mejor llega a {Math.round(settings.win_probability * 100)}%
                  de probabilidad y {num(settings.min_conversions_to_win)} agendas. Tú decides si la fijas.
                </li>
              </ol>
              <p className="text-muted-foreground">
                Cada visitante ve siempre la misma combinación, y después de agendar ya no cambia.
              </p>
            </CardContent>
          </Card>
          <RulesCard landing={landing} settings={settings} />
          <SampleSizeCard totals={totals} />
        </TabsContent>
        <TabsContent value="landing" className="mt-4 space-y-4">
          <LandingTab settings={settings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
