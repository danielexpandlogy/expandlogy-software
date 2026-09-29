import { addDays, format, isBefore, nextMonday, set, startOfMinute } from "date-fns";

export interface ReminderPreset {
  label: string;
  date: Date;
}

const at = (d: Date, hours: number) => set(d, { hours, minutes: 0, seconds: 0, milliseconds: 0 });

/**
 * Atajos del selector de recordatorio, en la zona horaria local. Los que ya
 * pasaron (p. ej. "Hoy 18:00" a las 19:00) no se ofrecen.
 * "Próximo lunes" un lunes es el de la semana siguiente.
 */
export function reminderPresets(now = new Date()): ReminderPreset[] {
  const presets = [
    { label: "Hoy, 18:00", date: at(now, 18) },
    { label: "Mañana, 9:00", date: at(addDays(now, 1), 9) },
    { label: "Próximo lunes, 9:00", date: at(nextMonday(now), 9) },
  ];
  return presets.filter((p) => !isBefore(p.date, now));
}

/** Un recordatorio válido es estrictamente futuro (con precisión de minuto). */
export function isFutureReminder(date: Date, now = new Date()) {
  return startOfMinute(date) > startOfMinute(now);
}

/** Valor para <input type="datetime-local"> en hora local. */
export const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
