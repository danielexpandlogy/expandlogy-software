import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  placeholder: string;
  onCreate: (title: string) => void;
  /** Después de crear, deja el input abierto para encadenar otra. */
  chain?: boolean;
  maxLength?: number;
  className?: string;
  icon?: ReactNode;
}

/** "+ Añadir …" que se convierte en un input: Enter crea, Esc cierra. */
export function InlineCreate({ label, placeholder, onCreate, chain = true, maxLength = 500, className, icon }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const submit = () => {
    const title = value.trim();
    if (!title) return;
    onCreate(title);
    setValue("");
    if (!chain) setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground",
          className,
        )}
      >
        {icon ?? <Plus className="size-4" />}
        {label}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        } else if (e.key === "Escape") {
          setValue("");
          setOpen(false);
        }
      }}
      onBlur={() => {
        if (value.trim()) submit();
        setOpen(false);
      }}
      className={cn(
        "w-full rounded-lg border bg-card px-3 py-2 text-sm shadow-sm outline-none ring-ring focus-visible:ring-2",
        className,
      )}
    />
  );
}

/** "+ Añadir tarea": abre el formulario completo de nueva tarea. */
export function AddTaskButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground",
        className,
      )}
    >
      <Plus className="size-4" />
      Añadir tarea
    </button>
  );
}
