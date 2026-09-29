import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Board } from "@/lib/database.types";
import { useBoardMembers, useSetBoardMembers } from "../../api/boards";
import { MemberPicker } from "./MemberPicker";

/** Añadir o quitar personas de un tablero (sólo admins). Quien lo creó no se puede quitar. */
export function MembersDialog({ board, open, onOpenChange }: { board: Board; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: current } = useBoardMembers(open ? board.id : undefined);
  const setMembers = useSetBoardMembers(board.id);
  const [value, setValue] = useState<string[]>([]);

  useEffect(() => {
    if (open && current) setValue(current);
  }, [open, current]);

  const changed = !!current && (value.length !== current.length || value.some((id) => !current.includes(id)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        // El buscador aparece al cargar las personas: se enfoca él, no "Cancelar".
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Personas del tablero</DialogTitle>
          <DialogDescription>Quienes estén aquí verán “{board.name}” en su menú y podrán trabajar en él.</DialogDescription>
        </DialogHeader>
        {current ? <MemberPicker value={value} onChange={setValue} locked={[board.owner_id]} lockedLabel="creador" autoFocus /> : <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />}
        {setMembers.error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {setMembers.error.message}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!changed || !value.length || setMembers.isPending}
            onClick={() => setMembers.mutate(value, { onSuccess: () => onOpenChange(false) })}
          >
            {setMembers.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
