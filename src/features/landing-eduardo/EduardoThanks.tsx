import { useEffect } from "react";
import { trackConversion } from "@danielexpandlogy/landing-core";
import { baseContent, LANDING_KEY } from "./content";
import { useLandingHead } from "./useLandingHead";
import "./eduardo-thanks.css";

const META = {
  title: "Request Received | Eduardo Professional Tree Service LLC",
  description:
    "Thank you for your request. Eduardo Professional Tree Service LLC will contact you shortly to schedule your free estimate.",
};

/**
 * Página de gracias: GHL redirige aquí al agendar. Registra la agenda con la
 * combinación que vio el visitante (la guarda la landing en su navegador).
 */
const EduardoThanks = () => {
  // Si GHL la abre dentro del iframe del calendario, se lleva a la ventana principal.
  const inFrame = window.top !== window.self;
  useLandingHead(META);

  useEffect(() => {
    if (inFrame) {
      try {
        window.top!.location.href = window.location.href;
        return;
      } catch {
        // Ventana principal de otro dominio: se registra desde aquí.
      }
    }
    void trackConversion(LANDING_KEY);
  }, [inFrame]);

  return (
    <div className="edu-ty">
      <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
        <defs>
          <symbol id="icon-check" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8.6" />
            <path d="M8 12.3l2.6 2.6 5.4-5.4" />
          </symbol>
        </defs>
      </svg>

      <header className="site-header">
        <div className="wrap">
          <img className="logo" src={baseContent.logo.src} alt={baseContent.logo.alt} />
        </div>
      </header>

      <section className="thanks-hero">
        <div className="wrap">
          <h1>
            <span className="title-icon">
              <svg className="icon" aria-hidden="true">
                <use href="#icon-check" />
              </svg>
            </span>
            Request Received! <span className="highlight">We'll Contact You Soon.</span>
          </h1>
          <p className="lead">
            Thank you for choosing Eduardo Professional Tree Service LLC. We've received your request and one of our team
            members will contact you shortly to discuss your project and schedule your free estimate.
          </p>
          <div className="thanks-divider" />
          <div className="thanks-contact">
            <p>Need immediate assistance? Give us a call anytime. We're available 24/7.</p>
            <a className="phone-link" href="tel:16158873652">
              (615) 887-3652
            </a>
          </div>
          <p className="thanks-tagline">Protecting your home, one tree at a time.</p>
        </div>
      </section>
    </div>
  );
};

export default EduardoThanks;
