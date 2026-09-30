import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCreateLanding, useLandings, type LandingSummary } from "../api";
import { LandingForm, type LandingFields } from "../admin/LandingForm";
import { absoluteUrl } from "../admin/links";
import { num, rate } from "../admin/format";

const EMPTY: LandingFields = { landing: "", name: "", landing_url: "", thanks_url: "", accent_color: "#2563eb" };

function LandingCard({ summary }: { summary: LandingSummary }) {
  const { settings, totals, variables, testing } = summary;
  return (
    <Card className="shadow-none transition hover:border-foreground/20">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <Link to={`/landings/${settings.landing}`} className="flex items-center gap-2 font-semibold hover:underline">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: settings.accent_color }} aria-hidden="true" />
              <span className="truncate">{settings.name || settings.landing}</span>
            </Link>
            <p className="truncate font-mono text-xs text-muted-foreground">{settings.landing}</p>
          </div>
          {settings.landing_url && (
            <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
              <a href={absoluteUrl(settings.landing_url)} target="_blank" rel="noreferrer" aria-label={`Abrir ${settings.name}`}>
                <ExternalLink className="size-4" />
              </a>
            </Button>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Visitantes</dt>
            <dd className="font-semibold tabular-nums">{num(totals.visitors)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Agendas</dt>
            <dd className="font-semibold tabular-nums">
              {num(totals.conversions)} <span className="text-xs font-normal text-muted-foreground">{rate(totals.conversions, totals.visitors)}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">En prueba</dt>
            <dd className="font-semibold tabular-nums">
              {testing} <span className="text-xs font-normal text-muted-foreground">de {variables}</span>
            </dd>
          </div>
        </dl>
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link to={`/landings/${settings.landing}`}>Abrir panel</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Todas las landings del Landing Lab: una por cliente, cada una en su repo y dominio. */
const LandingsIndex = () => {
  const { data, isLoading, error } = useLandings();
  const create = useCreateLanding();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Landings</h2>
          <p className="text-sm text-muted-foreground">
            Cada landing vive en su propio repo y dominio; aquí se prueban sus variantes y se ven sus resultados.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 size-4" /> Nueva landing
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : error ? (
        <Card className="shadow-none">
          <CardContent className="space-y-1 p-6 text-sm">
            <p className="font-medium text-destructive">No se pudieron cargar las landings.</p>
            <p className="text-muted-foreground">
              {/column|lp_/i.test(error.message)
                ? "Falta aplicar supabase/migrations/20261002100000_landing_lab_multi.sql en el SQL Editor de Supabase."
                : error.message}
            </p>
          </CardContent>
        </Card>
      ) : data?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((s) => (
            <LandingCard key={s.settings.landing} summary={s} />
          ))}
        </div>
      ) : (
        <Card className="shadow-none">
          <CardContent className="p-6 text-sm text-muted-foreground">Todavía no hay landings. Crea la primera.</CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva landing</DialogTitle>
            <DialogDescription>Después agregas sus variables desde su panel.</DialogDescription>
          </DialogHeader>
          {open && (
            <LandingForm
              initial={EMPTY}
              isNew
              saving={create.isPending}
              submitLabel="Crear landing"
              onSubmit={(input) =>
                create.mutate(input, {
                  onSuccess: () => {
                    setOpen(false);
                    navigate(`/landings/${input.landing}`);
                  },
                })
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingsIndex;
