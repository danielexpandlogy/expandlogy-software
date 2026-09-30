import { useEffect } from "react";

const FONT_HREF = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap";
const FAVICON_HREF =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%2314130f'/%3E%3Ccircle cx='12' cy='12' r='7' fill='none' stroke='%23d9711f' stroke-width='1.6'/%3E%3Ccircle cx='12' cy='12' r='3.2' fill='none' stroke='%23d9711f' stroke-width='1.6'/%3E%3C/svg%3E";

/** Carga Inter (la fuente de la landing) para las vistas previas del panel. No se quita al salir. */
export function useInterFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
    const font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = FONT_HREF;
    document.head.appendChild(font);
  }, []);
}

/**
 * Pone el <head> de la landing (título, descripción, idioma, favicon, fuente)
 * mientras está montada y lo deja como estaba al salir. Sin Pixel de Meta a
 * propósito: el piloto no debe mandar eventos a la cuenta publicitaria.
 */
export function useLandingHead({ title, description }: { title: string; description: string }) {
  useEffect(() => {
    const html = document.documentElement;
    const prev = {
      title: document.title,
      lang: html.lang,
      scroll: html.style.scrollBehavior,
    };
    document.title = title;
    html.lang = "en";
    html.style.scrollBehavior = "smooth";

    const descMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prevDesc = descMeta?.content;
    if (descMeta) descMeta.content = description;

    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const prevIcon = icon ? { href: icon.href, type: icon.type } : null;
    if (icon) {
      icon.type = "image/svg+xml";
      icon.href = FAVICON_HREF;
    }

    const font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = FONT_HREF;
    document.head.appendChild(font);

    return () => {
      document.title = prev.title;
      html.lang = prev.lang;
      html.style.scrollBehavior = prev.scroll;
      if (descMeta && prevDesc !== undefined) descMeta.content = prevDesc;
      if (icon && prevIcon) {
        icon.type = prevIcon.type;
        icon.href = prevIcon.href;
      }
      font.remove();
    };
  }, [title, description]);
}

/** Script de LeadConnector que ajusta la altura del iframe de reservas. */
export function useBookingEmbedScript() {
  useEffect(() => {
    const src = "https://link.msgsndr.com/js/form_embed.js";
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.type = "text/javascript";
    document.body.appendChild(script);
  }, []);
}
