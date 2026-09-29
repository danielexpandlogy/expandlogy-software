import type { ReactNode } from "react";

// Sólo http(s):// o www.: `javascript:` y otros esquemas nunca se enlazan.
// El último carácter no puede ser puntuación de cierre de frase.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,:;!?)\]}]/gi;

/**
 * Texto plano → nodos de React con los enlaces clicables. Nunca interpreta
 * HTML ni markdown (no hay dangerouslySetInnerHTML): `<script>` se ve como texto.
 */
export function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const raw = match[0];
    if (start > last) out.push(text.slice(last, start));
    const href = raw.toLowerCase().startsWith("www.") ? `https://${raw}` : raw;
    out.push(
      <a key={start} href={href} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline underline-offset-2">
        {raw}
      </a>,
    );
    last = start + raw.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
