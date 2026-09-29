import type { BoardData } from "../../lib/tree";
import { CommentsSection } from "../comments/CommentsSection";
import { TaskDetailSheet } from "./TaskDetailSheet";

/** Detalle + comentarios: punto de entrada del chunk que se carga al abrir una tarea. */
export default function TaskDetailPanel(props: {
  data: BoardData;
  taskId: string;
  onNavigate: (id: string) => void;
  onClose: () => void;
}) {
  return <TaskDetailSheet {...props} footer={(task) => <CommentsSection task={task} />} />;
}
