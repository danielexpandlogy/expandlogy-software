import { useLayoutEffect, useRef, useState } from "react";

/**
 * La landing publicada dentro de un iframe, dibujada a `width` px (como una
 * pantalla de escritorio) y escalada al ancho disponible. Se puede hacer scroll
 * dentro. Sirve para landings en otros dominios, cuyo código no está aquí.
 */
export function LivePreview({ url, title, width = 1280, height = 820 }: { url: string; title: string; width?: number; height?: number }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const o = outer.current;
    if (!o) return;
    const measure = () => setScale(o.clientWidth / width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(o);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={outer} className="relative w-full overflow-hidden rounded-lg border bg-muted" style={{ height: Math.max(height * scale, 120) }}>
      <iframe
        src={url}
        title={title}
        loading="lazy"
        className="absolute left-0 top-0 border-0 bg-white"
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}
      />
    </div>
  );
}
