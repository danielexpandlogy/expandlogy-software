import { describe, expect, it, vi } from "vitest";
import { recordingMimeType } from "./media";

describe("recordingMimeType", () => {
  it("prefiere MP4/AAC si el navegador lo graba (lo reproducen todos, también Safari)", () => {
    vi.stubGlobal("MediaRecorder", class {});
    expect(recordingMimeType(() => true)).toBe("audio/mp4;codecs=mp4a.40.2");
  });
  it("cae a WebM/Opus si no hay MP4 (Firefox)", () => {
    vi.stubGlobal("MediaRecorder", class {});
    expect(recordingMimeType((t) => t.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
  });
  it("sin MediaRecorder no se puede grabar", () => {
    vi.stubGlobal("MediaRecorder", undefined);
    expect(recordingMimeType(() => true)).toBeNull();
    vi.unstubAllGlobals();
  });
});
