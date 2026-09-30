import { afterEach, describe, expect, it, vi } from "vitest";
import { configureLandingLab, rpc } from "./client";
import { isTeamBrowser, readPreview } from "./params";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const respond = (status: number, body: string) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, text: () => Promise.resolve(body) });

describe("rpc", () => {
  it("llama a /rest/v1/rpc con la clave pública", async () => {
    const fetchMock = respond(200, '{"ok":true}');
    vi.stubGlobal("fetch", fetchMock);
    configureLandingLab({ supabaseUrl: "https://abc.supabase.co/", supabaseAnonKey: "sb_publishable_x" });

    await expect(rpc("lp_public_config", { p_landing: "luqman" })).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://abc.supabase.co/rest/v1/rpc/lp_public_config");
    expect(init.headers).toEqual({ apikey: "sb_publishable_x", "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ p_landing: "luqman" });
  });

  it("manda Authorization con las claves JWT antiguas", async () => {
    const fetchMock = respond(204, "");
    vi.stubGlobal("fetch", fetchMock);
    configureLandingLab({ supabaseUrl: "https://abc.supabase.co", supabaseAnonKey: "eyJhbGci.x.y" });

    await expect(rpc("lp_track_visit", {})).resolves.toBeNull();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer eyJhbGci.x.y");
  });

  it("propaga el mensaje de error de Supabase", async () => {
    vi.stubGlobal("fetch", respond(400, '{"message":"Landing desconocida"}'));
    configureLandingLab({ supabaseUrl: "https://abc.supabase.co", supabaseAnonKey: "k" });
    await expect(rpc("lp_track_visit", {})).rejects.toThrow("Landing desconocida");
  });
});

describe("params", () => {
  it("lee las opciones forzadas de ?lp_preview", () => {
    expect(readPreview("?lp_preview=a,%20b,,c")).toEqual(["a", "b", "c"]);
    expect(readPreview("")).toEqual([]);
  });

  it("?lp_team=1 marca el navegador y ?lp_team=0 lo desmarca", () => {
    expect(isTeamBrowser("")).toBe(false);
    expect(isTeamBrowser("?lp_team=1")).toBe(true);
    expect(isTeamBrowser("?utm_source=x")).toBe(true);
    expect(isTeamBrowser("?lp_team=0")).toBe(false);
  });
});
