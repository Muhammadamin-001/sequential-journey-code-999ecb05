export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          completed_tasks: number
          completion_rate: number
          created_at: string
          details: Json
          id: string
          missed_tasks: number
          report_date: string
          summary: string | null
          total_tasks: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_tasks?: number
          completion_rate?: number
          created_at?: string
          details?: Json
          id?: string
          missed_tasks?: number
          report_date: string
          summary?: string | null
          total_tasks?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_tasks?: number
          completion_rate?: number
          created_at?: string
          details?: Json
          id?: string
          missed_tasks?: number
          report_date?: string
          summary?: string | null
          total_tasks?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          metadata: Json
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          telegram_id: number | null
          telegram_username: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          telegram_id?: number | null
          telegram_username?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          telegram_id?: number | null
          telegram_username?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      sections: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          icon: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      task_history: {
        Row: {
          created_at: string
          id: string
          note: string | null
          occurred_on: string
          status: Database["public"]["Enums"]["task_status"]
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          occurred_on?: string
          status: Database["public"]["Enums"]["task_status"]
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          occurred_on?: string
          status?: Database["public"]["Enums"]["task_status"]
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          deadline_at: string | null
          description: string | null
          id: string
          metadata: Json
          priority: Database["public"]["Enums"]["task_priority"]
          recurrence: Json | null
          reminder_at: string | null
          section_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deadline_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence?: Json | null
          reminder_at?: string | null
          section_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deadline_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence?: Json | null
          reminder_at?: string | null
          section_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_pending_registrations: {
        Row: {
          chat_id: number
          created_at: string
          full_name: string | null
          step: string
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          full_name?: string | null
          step: string
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          full_name?: string | null
          step?: string
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          completed_tasks: number
          completion_rate: number
          created_at: string
          details: Json
          id: string
          missed_tasks: number
          summary: string | null
          total_tasks: number
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          completed_tasks?: number
          completion_rate?: number
          created_at?: string
          details?: Json
          id?: string
          missed_tasks?: number
          summary?: string | null
          total_tasks?: number
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          completed_tasks?: number
          completion_rate?: number
          created_at?: string
          details?: Json
          id?: string
          missed_tasks?: number
          summary?: string | null
          total_tasks?: number
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "user"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "missed"
        | "cancelled"
      task_type: "daily" | "deadline" | "onetime"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "user"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: [
        "pending",
        "in_progress",
        "completed",
        "missed",
        "cancelled",
      ],
      task_type: ["daily", "deadline", "onetime"],
    },
  },
} as const
