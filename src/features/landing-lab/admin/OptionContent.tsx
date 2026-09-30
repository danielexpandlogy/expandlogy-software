import { HEX_COLOR, type VariableKind } from "@danielexpandlogy/landing-core";

const text = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * El contenido real de una opción (lo que ve el visitante), compacto para la
 * tabla del panel: el titular completo, la miniatura, el botón o el orden.
 */
export function OptionContent({
  kind,
  value,
  sectionLabels,
  accent,
}: {
  kind: VariableKind;
  value: Record<string, unknown>;
  sectionLabels: Record<string, string>;
  /** Color de marca de la landing: resaltado del titular y botones. */
  accent: string;
}) {
  switch (kind) {
    case "headline":
      return (
        <p className="max-w-md text-[15px] font-semibold leading-snug text-foreground">
          {text(value.before)}
          <span style={{ color: accent }}>{text(value.highlight)}</span>
          {text(value.after)}
        </p>
      );
    case "text":
      return <p className="line-clamp-3 max-w-md whitespace-pre-line text-sm text-foreground">{text(value.text)}</p>;
    case "image":
      return (
        <a
          href={text(value.src)}
          target="_blank"
          rel="noreferrer"
          className="group flex max-w-md items-center gap-3"
          title="Abrir la imagen"
        >
          <img
            src={text(value.src)}
            alt=""
            loading="lazy"
            className="h-14 w-24 shrink-0 rounded-md border object-cover transition group-hover:opacity-80"
          />
          <span className="line-clamp-2 text-xs text-muted-foreground">{text(value.alt)}</span>
        </a>
      );
    case "cta":
      return (
        <span
          className="inline-flex flex-col items-center rounded-lg px-4 py-2 text-center text-white"
          style={{ background: accent }}
        >
          <span className="text-sm font-bold">▶ {text(value.label)}</span>
          {text(value.sub) && (
            <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-85">{text(value.sub)}</span>
          )}
        </span>
      );
    case "color": {
      const color = text(value.color);
      const hover = text(value.hover);
      return (
        <span className="inline-flex items-center gap-3">
          <span
            className="rounded-lg px-4 py-2 text-sm font-bold text-white"
            style={{ background: HEX_COLOR.test(color) ? color : "#999" }}
          >
            ▶ Botón
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {color}
            {hover && ` · hover ${hover}`}
          </span>
        </span>
      );
    }
    case "order": {
      const order = Array.isArray(value.order) ? (value.order as string[]) : [];
      return (
        <ol className="flex max-w-md flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
          {order.map((key, i) => (
            <li key={key} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted-foreground">→</span>}
              <span className={i === 0 ? "font-semibold text-foreground" : "text-muted-foreground"}>
                {sectionLabels[key] ?? key}
              </span>
            </li>
          ))}
        </ol>
      );
    }
  }
}
