import { Check, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useProfiles } from "@/hooks/use-users";
import { displayName, initials, ROLE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

interface Props {
  value: string[];
  onChange: (ids: string[]) => void;
  /** Ids que no se pueden quitar (p. ej. quien crea el tablero). */
  locked?: string[];
}

/** Selección múltiple de personas del equipo (admins y usuarios). Sólo admins: lee todos los perfiles. */
export function MemberPicker({ value, onChange, locked = [] }: Props) {
  const { data: profiles = [], isLoading } = useProfiles();
  const selected = profiles.filter((p) => value.includes(p.id));
  const toggle = (id: string) => {
    if (locked.includes(id)) return;
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Personas seleccionadas">
          {selected.map((p) => (
            <li key={p.id} className="flex items-center gap-1 rounded-full bg-accent py-0.5 pl-2 pr-1 text-xs font-medium text-accent-foreground">
              {displayName(p.full_name, p.email)}
              {!locked.includes(p.id) && (
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="grid size-4 place-items-center rounded-full hover:bg-background/60"
                  aria-label={`Quitar a ${displayName(p.full_name, p.email)}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Command className="rounded-lg border">
        <CommandInput placeholder="Buscar persona por nombre o email…" />
        <CommandList className="max-h-52">
          <CommandEmpty>{isLoading ? "Cargando…" : "Sin resultados."}</CommandEmpty>
          <CommandGroup>
            {profiles.map((p) => {
              const on = value.includes(p.id);
              return (
                <CommandItem
                  key={p.id}
                  value={`${p.full_name} ${p.email}`}
                  onSelect={() => toggle(p.id)}
                  className="gap-3"
                  aria-selected={on}
                  disabled={locked.includes(p.id)}
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                      {initials(p.full_name, p.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{displayName(p.full_name, p.email)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.email} · {ROLE_LABEL[p.role]}
                    </p>
                  </div>
                  <Check className={cn("size-4 text-primary", on ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
