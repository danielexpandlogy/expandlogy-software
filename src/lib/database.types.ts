// Tipos escritos a mano a partir de supabase/migrations. Si el esquema crece,
// conviene regenerarlos con `supabase gen types typescript --linked`.

export type AppRole = "admin" | "user";
export type TodoPriority = "low" | "medium" | "high";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  job_title: string;
  phone: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
};

/** personal: sólo su dueño. team: lo crea un admin y lo comparte con varias personas. */
export type BoardKind = "personal" | "team";

export type Board = {
  id: string;
  name: string;
  kind: BoardKind;
  owner_id: string;
  created_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BoardMember = {
  board_id: string;
  user_id: string;
  added_by: string | null;
  created_at: string;
};

export type BoardSummary = {
  id: string;
  name: string;
  kind: BoardKind;
  owner_id: string;
  /** La persona en sesión es miembro (lo ve en su menú). */
  is_member: boolean;
  member_count: number;
  archived_at: string | null;
  created_at: string;
  owner_name: string;
  owner_email: string;
  pending_count: number;
  completed_count: number;
};

/** Nombre visible de alguien relacionado con un tablero (RPC board_people). */
export type BoardPerson = Pick<Profile, "id" | "full_name" | "email" | "role">;

export type Section = {
  id: string;
  board_id: string;
  name: string;
  position: string;
  created_at: string;
};

export type Task = {
  id: string;
  board_id: string;
  /** null en subtareas: heredan la sección de su padre. */
  section_id: string | null;
  parent_id: string | null;
  title: string;
  description: string;
  priority: TodoPriority;
  due_date: string | null;
  /** Beta: se guarda, todavía no dispara notificaciones. */
  reminder_at: string | null;
  completed: boolean;
  completed_at: string | null;
  position: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  board_id: string;
  /** null si el autor fue eliminado. */
  author_id: string | null;
  body: string;
  edited_at: string | null;
  created_at: string;
};

export type CommentAttachment = {
  id: string;
  comment_id: string;
  board_id: string;
  kind: "image" | "audio";
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  created_by: string | null;
  created_at: string;
};

export type CommentWithAttachments = TaskComment & { comment_attachments: CommentAttachment[] };

/**
 * Adjunto ya subido a Storage que create_comment asocia al comentario. Tipo y
 * tamaño no se envían: el servidor los toma de la metadata de Storage.
 */
export type NewAttachment = {
  storage_path: string;
  kind: "image" | "audio";
  width?: number | null;
  height?: number | null;
  duration_ms?: number | null;
};

type TaskEditable = "title" | "description" | "priority" | "due_date" | "reminder_at" | "completed" | "position" | "section_id";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        // Los perfiles los crea el trigger handle_new_user, nunca el cliente.
        Insert: Record<string, never>;
        Update: Partial<Pick<Profile, "full_name" | "job_title" | "phone" | "role">>;
        Relationships: [];
      };
      boards: {
        Row: Board;
        Insert: Record<string, never>;
        Update: Partial<Pick<Board, "name" | "archived_at">>;
        Relationships: [];
      };
      board_members: {
        Row: BoardMember;
        Insert: Pick<BoardMember, "board_id" | "user_id">;
        Update: Record<string, never>;
        Relationships: [];
      };
      sections: {
        Row: Section;
        Insert: Pick<Section, "board_id" | "name" | "position"> & Partial<Pick<Section, "id">>;
        Update: Partial<Pick<Section, "name" | "position">>;
        Relationships: [];
      };
      tasks: {
        Row: Task;
        Insert: Pick<Task, "board_id" | "title" | "position"> &
          Partial<Pick<Task, "id" | "section_id" | "parent_id" | "description" | "priority" | "due_date" | "reminder_at" | "completed">>;
        Update: Partial<Pick<Task, TaskEditable>>;
        Relationships: [];
      };
      task_comments: {
        Row: TaskComment;
        // Sólo vía la RPC create_comment.
        Insert: Record<string, never>;
        Update: Pick<TaskComment, "body">;
        Relationships: [];
      };
      comment_attachments: {
        Row: CommentAttachment;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "comment_attachments_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "task_comments";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      board_summaries: { Row: BoardSummary; Relationships: [] };
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      can_access_board: { Args: { p_board_id: string }; Returns: boolean };
      create_board: { Args: { p_name: string; p_kind?: BoardKind; p_member_ids?: string[] }; Returns: string };
      set_board_members: { Args: { p_board_id: string; p_member_ids: string[] }; Returns: undefined };
      board_people: { Args: { p_board_id: string }; Returns: BoardPerson[] };
      task_comment_counts: { Args: { p_board_id: string }; Returns: { task_id: string; count: number }[] };
      create_comment: {
        Args: { p_task_id: string; p_body: string; p_attachments?: NewAttachment[] };
        Returns: TaskComment;
      };
    };
    Enums: {
      app_role: AppRole;
      todo_priority: TodoPriority;
    };
    CompositeTypes: Record<never, never>;
  };
};
