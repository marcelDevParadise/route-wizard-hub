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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          created_at: string
          display_name: string | null
          force_password_reset: boolean | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          force_password_reset?: boolean | null
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          force_password_reset?: boolean | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          created_at: string | null
          description: string | null
          end_at: string | null
          id: string
          location: string | null
          source: string | null
          start_at: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          location?: string | null
          source?: string | null
          start_at: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          location?: string | null
          source?: string | null
          start_at?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          attempt: number
          created_at: string
          destination_id: string | null
          event_id: string | null
          id: string
          last_error: string | null
          last_status_code: number | null
          latency_ms: number | null
          max_attempts: number
          next_attempt_at: string
          status: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          destination_id?: string | null
          event_id?: string | null
          id?: string
          last_error?: string | null
          last_status_code?: number | null
          latency_ms?: number | null
          max_attempts?: number
          next_attempt_at?: string
          status?: string
        }
        Update: {
          attempt?: number
          created_at?: string
          destination_id?: string | null
          event_id?: string | null
          id?: string
          last_error?: string | null
          last_status_code?: number | null
          latency_ms?: number | null
          max_attempts?: number
          next_attempt_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          id: string
          payload: Json
          received_at: string
          source_id: string | null
          source_key: string
          status: string
        }
        Insert: {
          id?: string
          payload: Json
          received_at?: string
          source_id?: string | null
          source_key: string
          status?: string
        }
        Update: {
          id?: string
          payload?: Json
          received_at?: string
          source_id?: string | null
          source_key?: string
          status?: string
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          created_at: string | null
          date: string
          id: string
          menu: Json
          source: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          menu: Json
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          menu?: Json
          source?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      news_items: {
        Row: {
          body: string | null
          category: string | null
          created_at: string | null
          id: string
          is_pinned: boolean | null
          published_at: string
          source: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          published_at: string
          source?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          published_at?: string
          source?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          request_count: number | null
          source_key: string
          window_start: string | null
        }
        Insert: {
          request_count?: number | null
          source_key: string
          window_start?: string | null
        }
        Update: {
          request_count?: number | null
          source_key?: string
          window_start?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_min_role: {
        Args: { _min: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      inbound_source_exists: {
        Args: { source_id: string }
        Returns: boolean
      }
      outbound_destination_exists: {
        Args: { destination_id: string }
        Returns: boolean
      }
      user_role: {
        Args: { _user_id: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
