import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isFutureReminder, reminderPresets, toLocalInput } from "../../lib/reminders";
import { BetaBadge } from "../shared/BetaBadge";

interface Props {
  value: string | null;
  onChange: (iso: string | null) => void;
}

/**
 * Recordatorio (Beta): se guarda en tasks.reminder_at, pero todavía no dispara
 * notificaciones. El texto lo dice explícitamente para no crear falsas expectativas.
 */
export function ReminderPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const current = value ? new Date(value) : null;
  const customDate = custom ? new Date(custom) : null;
  const customValid = !!customDate && !Number.isNaN(customDate.getTime()) && isFutureReminder(customDate);

  const pick = (d: Date) => {
    onChange(d.toISOString());
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setCustom(current && isFutureReminder(current) ? toLocalInput(current) : "");
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 font-normal" aria-label="Recordatorio (Beta)">
          <Bell className="size-3.5" />
          {current ? format(current, "d MMM, HH:mm", { locale: es }) : "Recordatorio"}
          <BetaBadge />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            Recordatorio <BetaBadge />
          </p>
          <p className="text-xs text-muted-foreground">
            Beta: por ahora el recordatorio queda guardado, pero todavía no envía notificaciones. Las notificaciones por
            email y push llegarán pronto.
          </p>
        </div>

        <div className="grid gap-1">
          {reminderPresets().map((p) => (
            <Button key={p.label} variant="ghost" size="sm" className="justify-between font-normal" onClick={() => pick(p.date)}>
              {p.label}
              <span className="text-xs text-muted-foreground">{format(p.date, "EEE d MMM", { locale: es })}</span>
            </Button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reminder-custom" className="text-xs">
            Fecha y hora
          </Label>
          <div className="flex gap-2">
            <Input
              id="reminder-custom"
              type="datetime-local"
              value={custom}
              min={toLocalInput(new Date())}
              onChange={(e) => setCustom(e.target.value)}
              className="h-8"
            />
            <Button size="sm" className="h-8" disabled={!customValid} onClick={() => customDate && pick(customDate)}>
              Guardar
            </Button>
          </div>
          {custom && !customValid && <p className="text-xs text-destructive">Elige una fecha futura.</p>}
        </div>

        {current && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <X className="mr-1.5 size-3.5" /> Quitar recordatorio
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
