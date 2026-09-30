import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isTeamBrowser, readPreview, useExperiment, type TrackMode } from "@danielexpandlogy/landing-core";
import { baseContent, LANDING_KEY, type LandingContent } from "./content";
import { applyVariants } from "./variants";
import { useBookingEmbedScript, useLandingHead } from "./useLandingHead";
import { BookingCard, HeroSection, Icon, LandingRoot, OrderedSections, SiteHeader } from "./LandingParts";

/**
 * Al tocar un CTA, el formulario "late" para llamar la atención: de inmediato si
 * ya está a la vista, o cuando el scroll suave termina de llevarlo a pantalla.
 */
function useBookingPulse(ref: React.RefObject<HTMLDivElement>, onCta?: () => void) {
  useEffect(() => {
    const card = ref.current;
    if (!card) return;
    let pending = false;
    const timers: number[] = [];

    const isVisible = () => {
      const r = card.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      return r.top < vh * 0.75 && r.bottom > vh * 0.25;
    };

    const fire = () => {
      pending = false;
      card.classList.remove("pulse");
      void card.offsetWidth; // reinicia la animación
      card.classList.add("pulse");
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (pending && entry.isIntersecting) fire();
        });
      },
      { threshold: 0.6 },
    );
    observer.observe(card);

    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('a[href="#booking"]')) return;
      onCta?.();
      if (isVisible()) {
        timers.push(window.setTimeout(fire, 50));
      } else {
        pending = true;
        timers.push(window.setTimeout(() => pending && fire(), 1200));
      }
    };
    document.addEventListener("click", onClick);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick);
      timers.forEach(clearTimeout);
    };
  }, [ref, onCta]);
}

export function EduardoLandingView({ content, onCtaClick }: { content: LandingContent; onCtaClick?: () => void }) {
  const bookingRef = useRef<HTMLDivElement>(null);
  useBookingEmbedScript();
  useBookingPulse(bookingRef, onCtaClick);
  const { booking, cta } = content;

  return (
    <LandingRoot content={content}>
      <SiteHeader content={content} />
      <HeroSection
        content={content}
        booking={
          <BookingCard
            content={content}
            cardRef={bookingRef}
            embed={
              <iframe
                src={`https://api.leadconnectorhq.com/widget/booking/${booking.widgetId}`}
                allow="payment"
                style={{ width: "100%", border: "none", overflow: "hidden" }}
                scrolling="no"
                id={booking.iframeId}
                title="Book your free estimate"
              />
            }
          />
        }
      />
      <OrderedSections content={content} />

      <footer>
        <div className="wrap">
          <p>{content.footer}</p>
        </div>
      </footer>

      <div className="mobile-cta">
        <a className="quote" href="#booking">
          <Icon name="arrow" solid />
          {cta.label}
        </a>
      </div>
    </LandingRoot>
  );
}

/** Mientras llega la configuración: logo y hero vacío, sin mostrar ninguna variante. */
const LandingPlaceholder = () => (
  <div className="edu-lp" aria-busy="true">
    <header className="site-header">
      <div className="wrap">
        <img className="logo" src={baseContent.logo.src} alt={baseContent.logo.alt} />
      </div>
    </header>
    <section className="hero" style={{ minHeight: "100vh" }} />
  </div>
);

const EduardoLanding = () => {
  useLandingHead(baseContent.meta);
  const { session, loading } = useAuth();
  const [params] = useSearchParams();
  const preview = useMemo(() => readPreview(params.toString()), [params]);
  const team = useMemo(() => isTeamBrowser(params.toString()), [params]);
  // No se registra al equipo (con sesión iniciada o navegador marcado) ni las vistas previas del panel.
  const mode: TrackMode = preview.length || team ? "skip" : loading ? "pending" : session ? "skip" : "track";
  const { ready, selection, trackClick } = useExperiment(LANDING_KEY, { mode, preview });
  const content = useMemo(() => applyVariants(baseContent, selection.values), [selection]);

  if (!ready) return <LandingPlaceholder />;
  return (
    <>
      <EduardoLandingView content={content} onCtaClick={trackClick} />
      {mode === "skip" && (
        <div className="edu-lp-note" role="status">
          {preview.length ? "Vista previa" : "Equipo"} · esta visita no se registra
          {selection.combo && <span> · {selection.combo}</span>}
        </div>
      )}
    </>
  );
};

export default EduardoLanding;
