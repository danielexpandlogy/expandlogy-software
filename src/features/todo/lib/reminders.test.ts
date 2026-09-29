import { describe, expect, it } from "vitest";
import { isFutureReminder, reminderPresets, toLocalInput } from "./reminders";

// Fechas en hora local: new Date(año, mes-1, día, hora, min).
describe("reminderPresets", () => {
  it("un martes por la mañana ofrece hoy 18:00, mañana 9:00 y el lunes siguiente", () => {
    const now = new Date(2026, 8, 29, 10, 30); // mar 29 sep 2026
    const p = reminderPresets(now);
    expect(p.map((x) => x.label)).toEqual(["Hoy, 18:00", "Mañana, 9:00", "Próximo lunes, 9:00"]);
    expect(toLocalInput(p[0].date)).toBe("2026-09-29T18:00");
    expect(toLocalInput(p[1].date)).toBe("2026-09-30T09:00");
    expect(toLocalInput(p[2].date)).toBe("2026-10-05T09:00");
  });

  it("después de las 18:00 no ofrece 'Hoy'", () => {
    const p = reminderPresets(new Date(2026, 8, 29, 19, 0));
    expect(p.map((x) => x.label)).toEqual(["Mañana, 9:00", "Próximo lunes, 9:00"]);
  });

  it("un lunes, 'Próximo lunes' es el de la semana siguiente", () => {
    const p = reminderPresets(new Date(2026, 9, 5, 8, 0)); // lun 5 oct
    expect(toLocalInput(p.find((x) => x.label.startsWith("Próximo"))!.date)).toBe("2026-10-12T09:00");
  });

  it("un domingo, 'Próximo lunes' es mañana y coincide con 'Mañana'", () => {
    const p = reminderPresets(new Date(2026, 9, 4, 8, 0)); // dom 4 oct
    expect(toLocalInput(p.find((x) => x.label.startsWith("Próximo"))!.date)).toBe("2026-10-05T09:00");
  });
});

describe("isFutureReminder", () => {
  const now = new Date(2026, 8, 29, 10, 30, 20);
  it("rechaza pasado y el mismo minuto; acepta el minuto siguiente", () => {
    expect(isFutureReminder(new Date(2026, 8, 29, 10, 0), now)).toBe(false);
    expect(isFutureReminder(new Date(2026, 8, 29, 10, 30, 50), now)).toBe(false);
    expect(isFutureReminder(new Date(2026, 8, 29, 10, 31), now)).toBe(true);
  });
});
