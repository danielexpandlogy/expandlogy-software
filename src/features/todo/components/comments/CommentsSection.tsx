import { useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { Task, TaskComment } from "@/lib/database.types";
import { chronological, useComments, useCreateComment, useDeleteComment, useUpdateComment } from "../../api/comments";
import { useBoardPeople } from "../../api/people";
import { useAttachmentDrafts } from "../../lib/use-attachment-drafts";
import type { NewAttachment } from "@/lib/database.types";
import { AttachmentChips, AttachmentGallery } from "./Attachments";
import { AudioRecorder } from "./AudioRecorder";
import { CommentComposer } from "./CommentComposer";
import { CommentItem } from "./CommentItem";

interface Pending {
  tempId: string;
  body: string;
  attachments: NewAttachment[];
  status: "sending" | "failed";
  createdAt: string;
}

/** Comentarios de una tarea o subtarea: lista plana, cronológica, sin respuestas. */
export function CommentsSection({ task }: { task: Task }) {
  const { session, isAdmin } = useAuth();
  const me = session?.user.id;
  const comments = useComments(task.id);
  const { data: people } = useBoardPeople(task.board_id);
  const createComment = useCreateComment(task.board_id, task.id);
  const updateComment = useUpdateComment(task.id);
  const deleteComment = useDeleteComment(task.board_id, task.id);
  const [pending, setPending] = useState<Pending[]>([]);
  const [toDelete, setToDelete] = useState<(TaskComment & { comment_attachments?: { storage_path: string }[] }) | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const drafts = useAttachmentDrafts(task.board_id, task.id);
  const [dragOver, setDragOver] = useState(false);

  const list = chronological(comments.data?.pages);
  const myself = me ? people?.get(me) : undefined;

  const send = (p: Pending) => {
    setPending((prev) => [...prev.filter((x) => x.tempId !== p.tempId), { ...p, status: "sending" }]);
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    createComment.mutate(
      { body: p.body, attachments: p.attachments },
      {
        onSuccess: () => setPending((prev) => prev.filter((x) => x.tempId !== p.tempId)),
        onError: () => setPending((prev) => prev.map((x) => (x.tempId === p.tempId ? { ...x, status: "failed" } : x))),
      },
    );
  };

  return (
    <section aria-labelledby={`comments-${task.id}`} className="space-y-4 border-t pt-5">
      <h3 id={`comments-${task.id}`} className="flex items-center gap-2 text-sm font-semibold">
        Comentarios
        {list.length > 0 && <span className="text-xs font-normal tabular-nums text-muted-foreground">{list.length}{comments.hasNextPage ? "+" : ""}</span>}
      </h3>

      {comments.hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={() => comments.fetchNextPage()}
          disabled={comments.isFetchingNextPage}
        >
          {comments.isFetchingNextPage && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
          Ver comentarios anteriores
        </Button>
      )}

      {comments.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando comentarios…</p>
      ) : comments.error ? (
        <p className="text-sm text-destructive">No se pudieron cargar los comentarios.</p>
      ) : (
        <div className="space-y-4" role="feed" aria-busy={comments.isFetching}>
          {list.map((c) => {
            const mine = c.author_id === me;
            return (
              <CommentItem
                key={c.id}
                author={c.author_id ? people?.get(c.author_id) : null}
                deletedAuthor={!c.author_id}
                body={c.body}
                createdAt={c.created_at}
                edited={!!c.edited_at}
                canEdit={mine}
                canDelete={mine || isAdmin}
                onEdit={(body) => updateComment.mutate({ id: c.id, body })}
                onDelete={() => setToDelete(c)}
                attachments={<AttachmentGallery attachments={c.comment_attachments ?? []} />}
              />
            );
          })}
          {pending.map((p) => (
            <CommentItem
              key={p.tempId}
              author={myself}
              body={p.body}
              createdAt={p.createdAt}
              status={p.status}
              onRetry={() => send(p)}
              onDiscard={() => setPending((prev) => prev.filter((x) => x.tempId !== p.tempId))}
              attachments={
                p.attachments.length ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.attachments.length} {p.attachments.length === 1 ? "adjunto" : "adjuntos"}
                  </p>
                ) : null
              }
            />
          ))}
          {!list.length && !pending.length && <p className="text-sm text-muted-foreground">Aún no hay comentarios.</p>}
          <div ref={endRef} className="scroll-mb-40" />
        </div>
      )}

      <div
        // Fijo al fondo del panel mientras se lee la conversación.
        className={cn(
          "sticky bottom-0 -mx-1 rounded-xl bg-background px-1 pb-2 pt-1 transition-colors",
          dragOver && "bg-accent ring-2 ring-primary ring-offset-2",
        )}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDragOver(false);
          drafts.addFiles(e.dataTransfer.files);
        }}
      >
        <CommentComposer
          hasAttachments={drafts.ready.length > 0}
          busy={drafts.busy}
          onPaste={(e) => {
            const files = [...e.clipboardData.files];
            if (files.length) {
              e.preventDefault();
              drafts.addFiles(files);
            }
          }}
          preview={<AttachmentChips drafts={drafts.drafts} onRemove={drafts.remove} />}
          tools={
            <>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif,audio/*"
                className="hidden"
                aria-label="Adjuntar imágenes o audios"
                onChange={(e) => {
                  if (e.target.files) drafts.addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                onClick={() => fileInput.current?.click()}
                aria-label="Adjuntar archivo"
              >
                <Paperclip className="size-4" />
              </Button>
              <AudioRecorder onRecorded={drafts.addRecording} />
              {drafts.busy && <span className="text-xs text-muted-foreground">Subiendo…</span>}
            </>
          }
          onSubmit={(body) => {
            send({
              tempId: crypto.randomUUID(),
              body,
              attachments: drafts.ready,
              status: "sending",
              createdAt: new Date().toISOString(),
            });
            drafts.clear();
          }}
        />
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este comentario?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && deleteComment.mutate(toDelete)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
