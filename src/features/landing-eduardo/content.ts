/**
 * Copy de la landing de Eduardo Professional Tree Service, separado del layout.
 * Es la variante base ("control") del piloto de autooptimización: las variantes
 * futuras serán objetos con esta misma forma.
 */

export type IconName = "tree" | "alert" | "rings" | "shield" | "check" | "tag" | "pin" | "arrow";

/** Landing en el Landing Lab (lp_settings.landing). */
export const LANDING_KEY = "eduardo";

/** Secciones entre el hero y el footer, en el orden original. */
export const SECTION_KEYS = ["signs", "services", "process", "ctaBand", "testimonials", "area", "why"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export interface LandingContent {
  meta: { title: string; description: string };
  /** Color de los botones de agendar (normal y hover). */
  theme: { button: string; buttonHover: string };
  sectionOrder: SectionKey[];
  logo: { src: string; alt: string };
  cta: { label: string; sub: string };
  hero: {
    badge: string;
    /** El titular se parte en tres para resaltar `highlight` en naranja. */
    title: { before: string; highlight: string; after: string };
    lead: string;
    image: { src: string; alt: string };
    trust: string[];
  };
  booking: {
    title: { before: string; highlight: string; after: string };
    sub: string;
    stars: string;
    rating: string;
    widgetId: string;
    iframeId: string;
  };
  signs: { eyebrow: string; title: string; intro: string; items: string[] };
  services: {
    eyebrow: string;
    title: string;
    intro: string;
    cards: {
      variant?: "emergency" | "stump";
      icon: IconName;
      image: { src: string; alt: string };
      title: string;
      body: string;
      bullets: string[];
    }[];
  };
  process: { eyebrow: string; title: string; intro: string; steps: { title: string; body: string }[] };
  ctaBand: string;
  testimonials: {
    eyebrow: string;
    title: string;
    stars: string;
    rating: string;
    intro: string;
    reviews: { stars: string; quote: string; name: string }[];
  };
  area: { eyebrow: string; title: string; intro: string; places: string[] };
  why: {
    eyebrow: string;
    title: string;
    lead: string;
    copy: string;
    stats: { num: string; label: string }[];
  };
  footer: string;
}

const MEDIA = "https://assets.cdn.filesafe.space/Vyux6gA2uQ0it9GxuuhX/media";
const FIVE_STARS = "★★★★★";
const RATING_STARS = "★★★★☆";

export const baseContent: LandingContent = {
  meta: {
    title: "Eduardo Professional Tree Service LLC | Free Tree Removal Estimate",
    description:
      "Local tree removal & stump grinding experts serving Murfreesboro, TN and homeowners within a 50-mile radius. Licensed & insured. Book your free estimate today.",
  },
  theme: { button: "#d9711f", buttonHover: "#b25a16" },
  sectionOrder: [...SECTION_KEYS],
  logo: {
    src: "https://msgsndr-private.storage.googleapis.com/locationPhotos/03c961c6-129c-4462-bd81-17bab56d84be.png",
    alt: "Eduardo Professional Tree Service LLC logo",
  },
  cta: { label: "Book My Free Estimate", sub: "Limited Weekly Availability" },
  hero: {
    badge: "Murfreesboro, TN & 50-Mile Radius",
    title: { before: "Branches Over Your Roof? Your Yard Should Feel ", highlight: "Safe Again", after: "." },
    lead: "Don't wait for a small risk to become a costly repair. We know it's stressful not knowing whether a tree is truly dangerous — that's why we offer a free, same-day safety assessment and an honest answer, so you can take back your peace of mind.",
    image: {
      src: `${MEDIA}/6ab835e51f3be2be1bd5dace.jpg`,
      alt: "A street blocked by a fallen tree during a storm, and the same street safe and clear afterward",
    },
    trust: ["10+ Years of Experience", "2,500+ Trees Safely Removed"],
  },
  booking: {
    title: { before: "Get Your ", highlight: "Free", after: " Tree Removal Estimate" },
    sub: "Trusted Tree Removal & Stump Grinding Professionals",
    stars: RATING_STARS,
    rating: "(4.5) Overall Rating",
    widgetId: "B4jozmZP91iaxGKefAM2",
    iframeId: "B4jozmZP91iaxGKefAM2_1790437032028",
  },
  signs: {
    eyebrow: "Warning Signs",
    title: "Does Your Tree Show Any of These Warning Signs?",
    intro:
      "A tree rarely falls without warning. If you notice any of these, it's worth a closer look — schedule a free estimate.",
    items: [
      "Branches hanging over your roof or driveway",
      "A trunk that leans more than it used to",
      "Cracks, splits, or dead branches with no leaves",
      "Roots lifting your sidewalk, patio, or foundation",
      "Mushrooms or soft, hollow spots at the base",
      "Storm damage that hasn't been inspected yet",
    ],
  },
  services: {
    eyebrow: "What We Do",
    title: "Professional Tree Removal & Stump Grinding",
    intro:
      "Safe, reliable solutions for dangerous trees, unwanted stumps, and storm-damaged properties throughout Middle Tennessee.",
    cards: [
      {
        icon: "tree",
        image: { src: `${MEDIA}/6ab835e53ae3da26fb86fe38.jpg`, alt: "Professional cutting down a tree with a chainsaw" },
        title: "Professional Tree Removal",
        body: "Safely removing dead, hazardous, storm-damaged, or unwanted trees using professional equipment and proven techniques that protect your home and property.",
        bullets: ["Dangerous Tree Removal", "Storm-Damaged Tree Removal", "Hazard Assessment", "Complete Property Cleanup"],
      },
      {
        variant: "emergency",
        icon: "alert",
        image: { src: `${MEDIA}/6ab835e53ae3da26fb86fe32.jpg`, alt: "Emergency crew removing a fallen tree blocking a road" },
        title: "Emergency Tree Removal",
        body: "When storms or fallen trees create an immediate safety hazard, our team responds quickly to remove dangerous trees safely.",
        bullets: ["Rapid Emergency Response", "Fallen Tree Removal", "Storm Damage Cleanup", "Safe & Efficient Service"],
      },
      {
        variant: "stump",
        icon: "rings",
        image: { src: `${MEDIA}/6ab835e53ae3da26fb86fe39.jpg`, alt: "Old tree stump ready for grinding and removal" },
        title: "Stump Grinding & Removal",
        body: "Remove unsightly stumps, eliminate trip hazards, and reclaim valuable yard space with professional stump grinding services.",
        bullets: ["Stump Grinding", "Complete Stump Removal", "Yard Restoration Ready", "Clean Work Area"],
      },
    ],
  },
  process: {
    eyebrow: "Getting Started Is Easy",
    title: "How It Works",
    intro: "No pressure, no confusing quotes — just a clear, simple path from a worrying tree to a safe, clean yard.",
    steps: [
      {
        title: "Book Your Free Estimate",
        body: "Tell us a bit about your tree and pick a time that works for you — it takes less than a minute, no phone tag required.",
      },
      {
        title: "Get an Honest, Same-Day Price",
        body: "We'll walk your property, assess the real risk, and give you a clear price on the spot — no pressure, no surprises later.",
      },
      {
        title: "We Handle the Hard Part",
        body: "Once you say go, our licensed crew removes the tree safely — protecting your home, your family, and everything around it.",
      },
      {
        title: "Enjoy Your Yard Again",
        body: "We clean up every branch and leaf before we leave, so all that's left is the relief of knowing your home is safe.",
      },
    ],
  },
  ctaBand: "Only a limited number of estimate appointments are available each week.",
  testimonials: {
    eyebrow: "Customer Reviews",
    title: "What Your Neighbors Are Saying",
    stars: RATING_STARS,
    rating: "(4.5) Overall Rating",
    intro: "5-star service. Read our latest customer reviews.",
    reviews: [
      {
        stars: FIVE_STARS,
        quote:
          "Eduardo and his crew did an outstanding job removing a large oak tree that was too close to our house. They worked safely, cleaned everything up, and left the yard looking great. I highly recommend them.",
        name: "Kelly R.",
      },
      {
        stars: FIVE_STARS,
        quote:
          "We needed two dead trees removed before storm season, and they responded quickly with a fair estimate. The crew was professional, respectful, and finished the job faster than expected.",
        name: "Charlie L.",
      },
      {
        stars: FIVE_STARS,
        quote:
          "I had an old stump in my backyard that made mowing difficult. They ground it down completely and cleaned up every bit of debris. The yard looks so much better now. Great experience!",
        name: "Amanda L.",
      },
      {
        stars: FIVE_STARS,
        quote:
          "Very professional team with excellent communication. They removed a dangerous tree hanging over our driveway and completed the work safely without damaging anything. I wouldn't hesitate to hire them again.",
        name: "Leland S.",
      },
      {
        stars: FIVE_STARS,
        quote:
          "After a recent storm, we had a large tree fall across part of our property. Eduardo Professional Tree Service arrived quickly, removed the tree safely, and had everything cleaned up the same day. Outstanding work.",
        name: "Eric",
      },
      {
        stars: FIVE_STARS,
        quote:
          "Great pricing, honest recommendations, and quality work. They removed several trees and ground the stumps exactly as promised. The crew was friendly, efficient, and left our property spotless.",
        name: "Renee",
      },
    ],
  },
  area: {
    eyebrow: "Local Tree Service",
    title: "Our Service Area",
    intro: "Serving homeowners within a 50-mile radius of Murfreesboro, Tennessee.",
    places: [
      "Murfreesboro",
      "Nashville",
      "Brentwood",
      "Smyrna",
      "Franklin",
      "Lebanon",
      "Goodlettsville",
      "Hermitage",
      "Mount Juliet",
      "Nolensville",
      "Hendersonville",
      "Surrounding Middle TN",
    ],
  },
  why: {
    eyebrow: "Why Homeowners Choose Us",
    title: "Why Homeowners Choose Eduardo Professional Tree Service LLC",
    lead: "We provide safe, reliable tree removal and stump grinding with professional equipment, honest pricing, and complete cleanup.",
    copy: "Our goal is to protect your property while delivering dependable service every step of the way. We don't just cut trees; we manage risk. With specialized equipment and a safety-first culture, we've become a preferred choice across Middle Tennessee.",
    stats: [
      { num: "10+", label: "Years of Experience" },
      { num: "2,500+", label: "Trees Safely Removed" },
      { num: "100%", label: "Fully Licensed & Insured" },
    ],
  },
  footer:
    "Legal Disclaimer: This site is not affiliated with META Inc. or any entity of META Inc. After leaving META Inc., the responsibility no longer lies with them but with our site. We do not sell your email or any information to third parties. We never engage in any form of spam. Additionally, this site is not affiliated with Google LLC or any of its subsidiaries. All trademarks, logos, and brand names are the property of their respective owners. Google does not endorse or sponsor this website, and any references to Google products or services are for informational purposes only.",
};
