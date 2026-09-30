// Tipos escritos a mano a partir de supabase/migrations. Si el esquema crece,
// conviene regenerarlos con `supabase gen types typescript --linked`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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

export type Board = {
  id: string;
  name: string;
  /** Quien lo creó: siempre es miembro y no se le puede quitar. */
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

// ── Landing Lab (A/B testing de landings públicas) ──────────────────────────

export type LpSettings = {
  landing: string;
  name: string;
  /** https://… (dominio del cliente) o /ruta (landing dentro de esta app). */
  landing_url: string | null;
  thanks_url: string | null;
  accent_color: string;
  auto_optimize: boolean;
  min_visitors_per_option: number;
  min_conversions_to_win: number;
  win_probability: number;
  traffic_floor: number;
  updated_at: string;
  created_at: string;
};

export type LpVariableKind = "headline" | "text" | "image" | "cta" | "color" | "order";

/** Ajustes del tipo de variable. 'order': las secciones que se pueden reordenar. */
export type LpVariableConfig = { sections?: { key: string; label: string }[] };

export type LpVariable = {
  id: string;
  landing: string;
  key: string;
  name: string;
  description: string;
  kind: LpVariableKind;
  config: LpVariableConfig;
  enabled: boolean;
  winner_option_id: string | null;
  position: number;
  created_at: string;
};

export type LpOption = {
  id: string;
  variable_id: string;
  label: string;
  value: Record<string, unknown>;
  is_control: boolean;
  active: boolean;
  position: number;
  created_at: string;
};

export type LpOptionStats = { option_id: string; variable_id: string; visitors: number; clicks: number; conversions: number };

export type LpLandingTotals = {
  landing: string;
  visitors: number;
  clicks: number;
  conversions: number;
  visitors_7d: number;
  conversions_7d: number;
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
      lp_settings: {
        Row: LpSettings;
        Insert: Pick<LpSettings, "landing" | "name"> & Partial<Pick<LpSettings, "landing_url" | "thanks_url" | "accent_color">>;
        Update: Partial<Omit<LpSettings, "landing" | "created_at">>;
        Relationships: [];
      };
      lp_variables: {
        Row: LpVariable;
        Insert: Record<string, never>;
        Update: Partial<Pick<LpVariable, "enabled" | "winner_option_id" | "name" | "description" | "config">>;
        Relationships: [];
      };
      lp_options: {
        Row: LpOption;
        Insert: Pick<LpOption, "variable_id" | "label" | "value"> & Partial<Pick<LpOption, "active" | "position">>;
        Update: Partial<Pick<LpOption, "label" | "value" | "active" | "position">>;
        Relationships: [
          {
            foreignKeyName: "lp_options_variable_id_fkey";
            columns: ["variable_id"];
            isOneToOne: false;
            referencedRelation: "lp_variables";
            referencedColumns: ["id"];
          },
        ];
      };
      lp_visitors: {
        Row: { id: string; landing: string; utm: Json; first_seen_at: string; last_seen_at: string; cta_clicked_at: string | null; converted_at: string | null };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      lp_assignments: {
        Row: { visitor_id: string; variable_id: string; option_id: string; assigned_at: string };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: {
      board_summaries: { Row: BoardSummary; Relationships: [] };
      lp_option_stats: { Row: LpOptionStats; Relationships: [] };
      lp_landing_totals: { Row: LpLandingTotals; Relationships: [] };
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      can_access_board: { Args: { p_board_id: string }; Returns: boolean };
      create_board: { Args: { p_name: string; p_member_ids?: string[] }; Returns: string };
      set_board_members: { Args: { p_board_id: string; p_member_ids: string[] }; Returns: undefined };
      board_people: { Args: { p_board_id: string }; Returns: BoardPerson[] };
      task_comment_counts: { Args: { p_board_id: string }; Returns: { task_id: string; count: number }[] };
      create_comment: {
        Args: { p_task_id: string; p_body: string; p_attachments?: NewAttachment[] };
        Returns: TaskComment;
      };
      lp_public_config: { Args: { p_landing: string }; Returns: Json };
      lp_track_visit: {
        Args: { p_landing: string; p_visitor_id: string; p_assignments: Json; p_utm?: Json };
        Returns: undefined;
      };
      lp_track_event: { Args: { p_landing: string; p_visitor_id: string; p_event: "cta_click" | "conversion" }; Returns: boolean };
      lp_create_variable: {
        Args: {
          p_landing: string;
          p_key: string;
          p_name: string;
          p_kind: LpVariableKind;
          p_description: string;
          p_config: Json;
          p_control_label: string;
          p_control_value: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: AppRole;
      todo_priority: TodoPriority;
    };
    CompositeTypes: Record<never, never>;
  };
};
