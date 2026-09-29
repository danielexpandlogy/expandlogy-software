import { cn } from "@/lib/utils";

interface CharCounterProps {
  value: string | null | undefined;
  max: number;
  className?: string;
}

/**
 * Contador de caracteres para campos con límite.
 *
 * El límite se valida en la base de datos con un trigger que solo actúa cuando
 * el campo cambia, así que el contenido guardado antes del límite sigue vivo y
 * puede aparecer por encima del máximo. En ese caso el contador se muestra en
 * rojo: el `maxLength` del campo deja borrar pero no agregar, que es justo lo
 * que se necesita para que el usuario recorte.
 */
export function CharCounter({ value, max, className }: CharCounterProps) {
  const len = (value ?? "").length;
  const over = len > max;
  const near = !over && len >= max * 0.8;

  return (
    <span
      className={cn(
        "text-[10px] tabular-nums shrink-0",
        over ? "text-destructive font-medium" : near ? "text-amber-600" : "text-muted-foreground",
        className,
      )}
    >
      {len.toLocaleString("es")}/{max.toLocaleString("es")}
    </span>
  );
}
