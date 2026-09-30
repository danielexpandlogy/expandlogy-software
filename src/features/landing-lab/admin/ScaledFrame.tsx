import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Dibuja `children` a `width` px (como una pantalla de escritorio) y lo escala
 * al ancho disponible, como una captura. `maxHeight` (en px de la pantalla
 * original) recorta lo que sobra con un difuminado. No es interactivo.
 */
export function ScaledFrame({ width = 1280, maxHeight, children }: { width?: number; maxHeight?: number; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    // inert: ni foco ni clics dentro de la captura (los enlaces de la landing no deben funcionar aquí).
    i.setAttribute("inert", "");
    const measure = () => {
      setScale(o.clientWidth / width);
      setHeight(i.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(o);
    observer.observe(i);
    return () => observer.disconnect();
  }, [width]);

  const visible = maxHeight ? Math.min(height, maxHeight) : height;
  const cropped = !!maxHeight && height > maxHeight;

  return (
    <div
      ref={outer}
      aria-hidden="true"
      className="relative w-full overflow-hidden rounded-lg border bg-muted"
      style={{ height: Math.max(visible * scale, 40) }}
    >
      <div
        ref={inner}
        style={{ width, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}
        className="absolute left-0 top-0"
      >
        {children}
      </div>
      {cropped && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/25 to-transparent" />}
    </div>
  );
}
