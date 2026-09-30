import { describe, expect, it } from "vitest";
import { baseContent, SECTION_KEYS } from "./content";
import { readOrder } from "@danielexpandlogy/landing-core";
import { applyVariants } from "./variants";

describe("applyVariants", () => {
  it("sin valores deja la landing original", () => {
    expect(applyVariants(baseContent, {})).toBe(baseContent);
  });

  it("aplica titular, imagen, CTA, color y orden", () => {
    const c = applyVariants(baseContent, {
      headline: { before: "A ", highlight: "B", after: "." },
      hero_image: { src: "https://x.test/a.jpg", alt: "alt" },
      cta_text: { label: "Go", sub: "Now" },
      button_color: { color: "#2f7d32", hover: "#25632a" },
      section_order: { order: ["testimonials", "signs"] },
    });
    expect(c.hero.title).toEqual({ before: "A ", highlight: "B", after: "." });
    expect(c.hero.image).toEqual({ src: "https://x.test/a.jpg", alt: "alt" });
    expect(c.cta).toEqual({ label: "Go", sub: "Now" });
    expect(c.theme).toEqual({ button: "#2f7d32", buttonHover: "#25632a" });
    expect(c.sectionOrder.slice(0, 3)).toEqual(["testimonials", "signs", "services"]);
    expect(c.sectionOrder).toHaveLength(SECTION_KEYS.length);
    // El resto no cambia.
    expect(c.services).toBe(baseContent.services);
  });

  it("ignora valores inválidos y variables desconocidas", () => {
    const c = applyVariants(baseContent, {
      headline: { before: 1 },
      hero_image: { src: "javascript:alert(1)" },
      cta_text: { label: "" },
      button_color: { color: "red" },
      section_order: { order: "signs" },
      otra: { x: 1 },
    });
    expect(c).toEqual(baseContent);
  });
});

describe("readOrder", () => {
  it("quita repetidas y desconocidas y completa las que faltan", () => {
    expect(readOrder({ order: ["why", "why", "nope"] }, SECTION_KEYS)).toEqual(["why", ...SECTION_KEYS.filter((k) => k !== "why")]);
    expect(readOrder({ order: [] }, SECTION_KEYS)).toBeNull();
  });
});
