import { readColor, readCta, readHeadline, readImage, readOrder } from "@danielexpandlogy/landing-core";
import { SECTION_KEYS, type LandingContent } from "./content";

/**
 * Cómo se aplica cada variable del Landing Lab sobre la landing base, por su
 * key en lp_variables (el tipo de cada una está en la base y decide el
 * formulario del panel). Un valor inválido se ignora (se ve el original).
 */

type Value = Record<string, unknown>;

const APPLY: Record<string, (content: LandingContent, value: Value) => LandingContent> = {
  headline: (content, value) => {
    const title = readHeadline(value);
    return title ? { ...content, hero: { ...content.hero, title } } : content;
  },
  hero_image: (content, value) => {
    const image = readImage(value);
    return image ? { ...content, hero: { ...content.hero, image } } : content;
  },
  cta_text: (content, value) => {
    const cta = readCta(value);
    return cta ? { ...content, cta } : content;
  },
  button_color: (content, value) => {
    const color = readColor(value);
    return color ? { ...content, theme: { button: color.color, buttonHover: color.hover } } : content;
  },
  section_order: (content, value) => {
    const order = readOrder(value, SECTION_KEYS);
    return order ? { ...content, sectionOrder: order } : content;
  },
};

/** Aplica los valores elegidos ({key de variable: valor}) sobre la landing base. */
export function applyVariants(base: LandingContent, values: Record<string, Value>): LandingContent {
  return Object.entries(values).reduce((content, [key, value]) => APPLY[key]?.(content, value) ?? content, base);
}
