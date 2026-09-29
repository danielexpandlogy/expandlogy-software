import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MoreHorizontal, Pencil, Trash2, UserX } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BoardPerson } from "@/lib/database.types";
import { displayName, initials } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { linkify } from "../../lib/linkify";
import { relativeTime } from "../../lib/time";

interface Props {
  author: BoardPerson | null | undefined;
  /** El autor fue eliminado (author_id nulo). */
  deletedAuthor?: boolean;
  body: string;
  createdAt: string;
  edited?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: (body: string) => void;
  onDelete?: () => void;
  /** Estado del envío optimista: "sending" (atenuado) o "failed" (con reintento). */
  status?: "sending" | "failed";
  onRetry?: () => void;
  onDiscard?: () => void;
  /** Adjuntos (Sprint 6). */
  attachments?: ReactNode;
}

/**
 * Un comentario. Lista plana a propósito: no existe "Responder" ni ninguna
 * forma de anidar comentarios (tampoco en el esquema: sin parent_comment_id).
 */
export function CommentItem({
  author,
  deletedAuthor,
  body,
  createdAt,
  edited,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  status,
  onRetry,
  onDiscard,
  attachments,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const name = deletedAuthor ? "Usuario eliminado" : author ? displayName(author.full_name, author.email) : "…";

  const save = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== body) onEdit?.(next);
    else setDraft(body);
  };

  return (
    // scroll-mb: el composer queda fijo abajo; al llevar un comentario a la vista no debe taparlo.
    <article className={cn("flex scroll-mb-40 gap-3", status === "sending" && "opacity-60")} aria-label={`Comentario de ${name}`}>
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
          {deletedAuthor ? <UserX className="size-4 text-muted-foreground" /> : author ? initials(author.full_name, author.email) : ""}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          <time
            dateTime={createdAt}
            title={format(new Date(createdAt), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
            className="shrink-0 text-xs text-muted-foreground"
          >
            {relativeTime(createdAt)}
          </time>
          {edited && <span className="text-xs text-muted-foreground">(editado)</span>}
          {(canEdit || canDelete) && !editing && !status && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-auto size-6 shrink-0 text-muted-foreground">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Opciones del comentario</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem
                    onSelect={() => {
                      setDraft(body);
                      setEditing(true);
                    }}
                  >
                    <Pencil className="mr-2 size-4" /> Editar
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 size-4" /> Eliminar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {editing ? (
          <div className="mt-1 space-y-2">
            <Textarea
              autoFocus
              value={draft}
              maxLength={5000}
              rows={3}
              aria-label="Editar comentario"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setDraft(body);
                  setEditing(false);
                }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(body);
                  setEditing(false);
                }}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={save} disabled={!draft.trim()}>
                Guardar
              </Button>
            </div>
          </div>
        ) : (
          body && <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{linkify(body)}</p>
        )}

        {attachments}

        {status === "failed" && (
          <p className="mt-1 flex items-center gap-2 text-xs text-destructive">
            No enviado ·
            <button type="button" className="font-medium underline" onClick={onRetry}>
              Reintentar
            </button>
            ·
            <button type="button" className="underline" onClick={onDiscard}>
              Descartar
            </button>
          </p>
        )}
      </div>
    </article>
  );
}
