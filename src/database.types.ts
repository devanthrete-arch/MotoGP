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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      autoflex_user_backups: {
        Row: {
          client_updated_at: string
          created_at: string
          payload: Json
          schema_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_updated_at: string
          created_at?: string
          payload: Json
          schema_version?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_updated_at?: string
          created_at?: string
          payload?: Json
          schema_version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          models: string[]
          topics: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          models?: string[]
          topics?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          models?: string[]
          topics?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      garage_vehicles: {
        Row: {
          brand: string
          city: string
          created_at: string
          deleted_at: string | null
          id: string
          model: string
          nickname: string
          odometer_km: number
          purchase_month: string
          updated_at: string
          user_id: string
          variant: string
        }
        Insert: {
          brand: string
          city?: string
          created_at?: string
          deleted_at?: string | null
          id: string
          model: string
          nickname?: string
          odometer_km?: number
          purchase_month?: string
          updated_at?: string
          user_id: string
          variant?: string
        }
        Update: {
          brand?: string
          city?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          model?: string
          nickname?: string
          odometer_km?: number
          purchase_month?: string
          updated_at?: string
          user_id?: string
          variant?: string
        }
        Relationships: []
      }
      owner_posts: {
        Row: {
          author: string
          body: string
          brand: string
          city: string
          created_at: string
          fixes_confirmed: number
          helpful: number
          id: string
          label: string
          model: string
          odometer_km: number
          title: string
          topic: string
          updated_at: string
          user_id: string
          variant: string
        }
        Insert: {
          author: string
          body: string
          brand: string
          city?: string
          created_at?: string
          fixes_confirmed?: number
          helpful?: number
          id: string
          label: string
          model: string
          odometer_km?: number
          title: string
          topic: string
          updated_at?: string
          user_id: string
          variant?: string
        }
        Update: {
          author?: string
          body?: string
          brand?: string
          city?: string
          created_at?: string
          fixes_confirmed?: number
          helpful?: number
          id?: string
          label?: string
          model?: string
          odometer_km?: number
          title?: string
          topic?: string
          updated_at?: string
          user_id?: string
          variant?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          author: string
          created_at: string
          id: string
          message: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author: string
          created_at?: string
          id?: string
          message: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author?: string
          created_at?: string
          id?: string
          message?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "owner_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          city: string
          created_at: string
          display_name: string
          garage_role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string
          created_at?: string
          display_name?: string
          garage_role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          display_name?: string
          garage_role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          post_id: string
          post_title: string
          reason: string
          reporter_name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          post_id: string
          post_title: string
          reason: string
          reporter_name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          post_title?: string
          reason?: string
          reporter_name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "owner_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "owner_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      shortlist_items: {
        Row: {
          brand: string
          budget: number
          created_at: string
          deleted_at: string | null
          id: string
          model: string
          notes: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand: string
          budget?: number
          created_at?: string
          deleted_at?: string | null
          id: string
          model: string
          notes?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string
          budget?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          model?: string
          notes?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_settings: {
        Row: {
          browser_alerts: boolean
          created_at: string
          email_digest: boolean
          quiet_hours: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          browser_alerts?: boolean
          created_at?: string
          email_digest?: boolean
          quiet_hours?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          browser_alerts?: boolean
          created_at?: string
          email_digest?: boolean
          quiet_hours?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      timeline_entries: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          happened_on: string
          id: string
          kind: string
          note: string
          odometer_km: number
          title: string
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          happened_on: string
          id: string
          kind: string
          note?: string
          odometer_km?: number
          title: string
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          happened_on?: string
          id?: string
          kind?: string
          note?: string
          odometer_km?: number
          title?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_entries_vehicle_id_user_id_fkey"
            columns: ["vehicle_id", "user_id"]
            isOneToOne: false
            referencedRelation: "garage_vehicles"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      sync_autoflex_workspace: { Args: { payload: Json }; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
