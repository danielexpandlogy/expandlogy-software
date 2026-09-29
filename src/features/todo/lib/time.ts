import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";

/** "hace un momento", "hace 5 minutos", "hace 2 días"… */
export function relativeTime(iso: string, now = new Date()) {
  const d = new Date(iso);
  if (now.getTime() - d.getTime() < 60_000) return "hace un momento";
  return formatDistanceToNowStrict(d, { addSuffix: true, locale: es });
}
