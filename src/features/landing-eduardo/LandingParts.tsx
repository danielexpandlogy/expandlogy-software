import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { IconName, LandingContent, SectionKey } from "./content";
import "./eduardo-landing.css";

/**
 * Piezas de la landing de Eduardo. Las usa la página real y las vistas previas
 * del panel, así que lo que se ve en /eduardo-admin es exactamente lo publicado.
 */

/** Sprite de íconos del original; cada <Icon> lo referencia con <use>. */
const IconSprite = () => (
  <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
    <defs>
      <symbol id="icon-tree" viewBox="0 0 24 24">
        <path d="M12 3l3.6 4.6h-2l3.2 4.1h-2.4L17.8 16H6.2l3.4-4.3H7.2l3.2-4.1h-2L12 3z" />
        <path d="M12 16v5" />
      </symbol>
      <symbol id="icon-alert" viewBox="0 0 24 24">
        <path d="M12 4.2l8.6 15.1H3.4L12 4.2z" />
        <path d="M12 10.2v4.2" />
        <circle cx="12" cy="17.2" r=".2" fill="currentColor" stroke="none" />
      </symbol>
      <symbol id="icon-rings" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.4" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.7" />
      </symbol>
      <symbol id="icon-shield" viewBox="0 0 24 24">
        <path d="M12 3.4l7 2.9v5.6c0 4.4-3 7.4-7 8.7-4-1.3-7-4.3-7-8.7V6.3l7-2.9z" />
        <path d="M8.7 12.2l2.2 2.2 4.4-4.4" />
      </symbol>
      <symbol id="icon-check" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.6" />
        <path d="M8 12.3l2.6 2.6 5.4-5.4" />
      </symbol>
      <symbol id="icon-tag" viewBox="0 0 24 24">
        <path d="M20.3 12.7L12.7 20.3a1.4 1.4 0 01-2 0l-7-7a1.4 1.4 0 010-2L11.3 3.7a1.4 1.4 0 011-.4H18a2 2 0 012 2v6.6a1.4 1.4 0 01-.4 1z" />
        <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
      </symbol>
      <symbol id="icon-pin" viewBox="0 0 24 24">
        <path d="M12 21s7-7.2 7-12.4A7 7 0 0 0 5 8.6C5 13.8 12 21 12 21z" />
        <circle cx="12" cy="8.6" r="2.3" />
      </symbol>
      <symbol id="icon-arrow" viewBox="0 0 24 24">
        <path d="M6 4l14 8-14 8V4z" />
      </symbol>
    </defs>
  </svg>
);

export const Icon = ({ name, solid }: { name: IconName; solid?: boolean }) => (
  <svg className={solid ? "icon icon-solid" : "icon"} aria-hidden="true">
    <use href={`#icon-${name}`} />
  </svg>
);

const Highlighted = ({ text }: { text: { before: string; highlight: string; after: string } }) => (
  <>
    {text.before}
    <span className="highlight">{text.highlight}</span>
    {text.after}
  </>
);

const CtaButton = ({ cta }: { cta: LandingContent["cta"] }) => (
  <a className="btn cta-block" href="#booking">
    <span className="btn-main">
      <Icon name="arrow" solid />
      {cta.label}
    </span>
    <span className="btn-sub">{cta.sub}</span>
  </a>
);

const SectionHead = ({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) => (
  <div className="section-head">
    <span className="eyebrow">{eyebrow}</span>
    <h2>{title}</h2>
    {children}
  </div>
);


/** Secciones blancas: entre dos seguidas va una línea divisoria, como en el original. */
const WHITE_SECTIONS: SectionKey[] = ["signs", "services", "why"];

/** Las secciones debajo del hero, por key (para poder ordenarlas). */
function buildSections(content: LandingContent): Record<SectionKey, ReactNode> {
  const { signs, services, process, testimonials, area, why, cta } = content;
  return {
    signs: (
      <section className="signs">
        <div className="wrap">
          <SectionHead eyebrow={signs.eyebrow} title={signs.title}>
            <p>{signs.intro}</p>
          </SectionHead>
          <div className="signs-grid">
            {signs.items.map((item) => (
              <div className="signs-item" key={item}>
                <Icon name="alert" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="section-cta">
            <CtaButton cta={cta} />
          </div>
        </div>
      </section>
    ),
    services: (
      <section className="services">
        <div className="wrap">
          <SectionHead eyebrow={services.eyebrow} title={services.title}>
            <p>{services.intro}</p>
          </SectionHead>
          <div className="service-grid">
            {services.cards.map((card) => (
              <div className={card.variant ? `service-card ${card.variant}` : "service-card"} key={card.title}>
                <div className="photo">
                  <img src={card.image.src} alt={card.image.alt} />
                </div>
                <div className="body">
                  <div className="icon-badge">
                    <Icon name={card.icon} />
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <ul>
                    {card.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          <div className="section-cta">
            <CtaButton cta={cta} />
          </div>
        </div>
      </section>
    ),
    process: (
      <section className="process">
        <div className="wrap">
          <SectionHead eyebrow={process.eyebrow} title={process.title}>
            <p>{process.intro}</p>
          </SectionHead>
          <div className="process-grid">
            {process.steps.map((step, i) => (
              <div className="process-step" key={step.title}>
                <div className="step-num">{i + 1}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    ),
    ctaBand: (
      <div className="cta-band">
        <div className="wrap">
          <p>{content.ctaBand}</p>
          <CtaButton cta={cta} />
        </div>
      </div>
    ),
    testimonials: (
      <section className="testimonials">
        <div className="wrap">
          <SectionHead eyebrow={testimonials.eyebrow} title={testimonials.title}>
            <div className="rating-badge">
              <span className="stars">{testimonials.stars}</span>
              <span className="num">{testimonials.rating}</span>
            </div>
            <p>{testimonials.intro}</p>
          </SectionHead>
          <div className="review-grid">
            {testimonials.reviews.map((review) => (
              <div className="review-card" key={review.name}>
                <div className="stars">{review.stars}</div>
                <p>"{review.quote}"</p>
                <div className="name">{review.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    ),
    area: (
      <section className="area">
        <div className="wrap">
          <SectionHead eyebrow={area.eyebrow} title={area.title}>
            <p>{area.intro}</p>
          </SectionHead>
          <div className="area-map">
            {area.places.map((place) => (
              <div className="area-card" key={place}>
                <Icon name="pin" />
                {place}
              </div>
            ))}
          </div>
          <div className="section-cta">
            <CtaButton cta={cta} />
          </div>
        </div>
      </section>
    ),
    why: (
      <section className="why">
        <div className="wrap why-grid">
          <div className="why-copy">
            <span className="eyebrow">{why.eyebrow}</span>
            <h2>{why.title}</h2>
            <p className="lead">{why.lead}</p>
            <p className="copy">{why.copy}</p>
          </div>
          <div className="stat-grid">
            {why.stats.map((stat) => (
              <div className="stat-card" key={stat.label}>
                <div className="num">{stat.num}</div>
                <div className="label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="wrap">
          <div className="section-cta">
            <CtaButton cta={cta} />
          </div>
        </div>
      </section>
    ),
  };
}

/** Contenedor de la landing: estilos acotados y color de los botones de la variante. */
export function LandingRoot({
  content,
  className,
  children,
}: {
  content: LandingContent;
  className?: string;
  children: ReactNode;
}) {
  const style = { "--btn": content.theme.button, "--btn-hover": content.theme.buttonHover } as React.CSSProperties;
  return (
    <div className={cn("edu-lp", className)} style={style}>
      <IconSprite />
      {children}
    </div>
  );
}

export const SiteHeader = ({ content }: { content: LandingContent }) => (
  <header className="site-header">
    <div className="wrap">
      <img className="logo" src={content.logo.src} alt={content.logo.alt} />
    </div>
  </header>
);

/** Tarjeta del calendario; `embed` es el iframe de GHL (o un marcador en las vistas previas del panel). */
export function BookingCard({
  content,
  embed,
  cardRef,
}: {
  content: LandingContent;
  embed: ReactNode;
  cardRef?: React.Ref<HTMLDivElement>;
}) {
  const { booking } = content;
  return (
    <div className="booking-card" id="booking" ref={cardRef}>
      <h2>
        <Highlighted text={booking.title} />
      </h2>
      <span className="sub">{booking.sub}</span>
      <div className="rating-row">
        <span className="stars">{booking.stars}</span>
        <span className="rating-text">{booking.rating}</span>
      </div>
      <div className="booking-embed">{embed}</div>
    </div>
  );
}

export function HeroSection({ content, booking }: { content: LandingContent; booking: ReactNode }) {
  const { hero } = content;
  return (
    <section className="hero">
      <div className="wrap">
        <div className="hero-copy">
          <span className="eyebrow-badge">
            <Icon name="pin" />
            {hero.badge}
          </span>
          <h1>
            <Highlighted text={hero.title} />
          </h1>
          <p className="lead">{hero.lead}</p>
          <img className="hero-image" src={hero.image.src} alt={hero.image.alt} />
          <div className="trust-row">
            {hero.trust.map((item, i) => (
              <Fragment key={item}>
                {i > 0 && <span className="dot">&middot;</span>}
                <span>{item}</span>
              </Fragment>
            ))}
          </div>
        </div>
        {booking}
      </div>
    </section>
  );
}

/** Una sola sección (vistas previas del panel). */
export function SingleSection({ content, section }: { content: LandingContent; section: SectionKey }) {
  return <>{buildSections(content)[section]}</>;
}

/** Las secciones en el orden de la variante, con la divisoria entre dos blancas seguidas. */
export function OrderedSections({ content }: { content: LandingContent }) {
  const sections = buildSections(content);
  return (
    <>
      {content.sectionOrder.map((key, i) => {
        const prev = content.sectionOrder[i - 1];
        const divider = prev && WHITE_SECTIONS.includes(prev) && WHITE_SECTIONS.includes(key);
        return (
          <Fragment key={key}>
            {divider && <hr className="section-divider" />}
            {sections[key]}
          </Fragment>
        );
      })}
    </>
  );
}

