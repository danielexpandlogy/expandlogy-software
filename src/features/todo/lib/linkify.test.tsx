import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { linkify } from "./linkify";

const html = (text: string) => render(<p>{linkify(text)}</p>).container.innerHTML;
const links = (text: string) =>
  [...render(<p>{linkify(text)}</p>).container.querySelectorAll("a")].map((a) => ({ href: a.getAttribute("href"), text: a.textContent }));

describe("linkify", () => {
  it("enlaza URLs con protocolo y con www.", () => {
    expect(links("mira https://expandlogy.com/precios y www.example.org")).toEqual([
      { href: "https://expandlogy.com/precios", text: "https://expandlogy.com/precios" },
      { href: "https://www.example.org", text: "www.example.org" },
    ]);
  });

  it("no incluye la puntuación final en el enlace", () => {
    expect(links("¿Viste https://a.com/x?, y (https://b.com).")).toEqual([
      { href: "https://a.com/x", text: "https://a.com/x" },
      { href: "https://b.com", text: "https://b.com" },
    ]);
  });

  it("abre en otra pestaña sin dar acceso a window.opener", () => {
    const a = render(<p>{linkify("https://a.com")}</p>).container.querySelector("a")!;
    expect(a.target).toBe("_blank");
    expect(a.rel).toBe("noopener noreferrer");
  });

  it("<script> y HTML se muestran como texto literal", () => {
    const out = html('<script>alert(1)</script><img src=x onerror="alert(2)">');
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
    expect(out).not.toContain("<img");
  });

  it("javascript: no se convierte en enlace", () => {
    expect(links("javascript:alert(1) y JAVASCRIPT://x")).toEqual([]);
  });

  it("texto sin enlaces queda intacto", () => {
    expect(linkify("hola\nmundo")).toEqual(["hola\nmundo"]);
  });
});
