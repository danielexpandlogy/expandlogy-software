import { ScaledFrame } from "@/features/landing-lab/admin/ScaledFrame";
import { baseContent } from "./content";
import { applyVariants } from "./variants";
import { BookingCard, HeroSection, LandingRoot, OrderedSections, SingleSection, SiteHeader } from "./LandingParts";
import { useInterFont } from "./useLandingHead";

/**
 * "Captura" de una opción para el panel: la landing real (mismos componentes y
 * estilos) con sólo esa opción aplicada, recortada a la parte donde se nota.
 */
export function EduardoPreview({ variableKey, value }: { variableKey: string; value: Record<string, unknown> }) {
  useInterFont();
  const content = applyVariants(baseContent, { [variableKey]: value });

  if (variableKey === "section_order") {
    return (
      <ScaledFrame maxHeight={2600}>
        <LandingRoot content={content} className="edu-lp-preview">
          <OrderedSections content={content} />
        </LandingRoot>
      </ScaledFrame>
    );
  }

  if (variableKey === "cta_text" || variableKey === "button_color") {
    return (
      <ScaledFrame>
        <LandingRoot content={content} className="edu-lp-preview">
          <SingleSection content={content} section="ctaBand" />
        </LandingRoot>
      </ScaledFrame>
    );
  }

  // Titular e imagen: lo que se ve al entrar (header + hero).
  return (
    <ScaledFrame maxHeight={1000}>
      <LandingRoot content={content} className="edu-lp-preview">
        <SiteHeader content={content} />
        <HeroSection
          content={content}
          booking={<BookingCard content={content} embed={<div className="embed-placeholder">Calendario de GHL</div>} />}
        />
      </LandingRoot>
    </ScaledFrame>
  );
}
