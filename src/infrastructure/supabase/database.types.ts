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
      city_circles: {
        Row: {
          city: string
          computed_at: string
          created_at: string
          curated_by: string | null
          garage_count: number
          headline: string
          hot_topics: string[]
          local_signal: string
          post_count: number
          slug: string
          state: string
          summary: string
          top_brands: string[]
          updated_at: string
        }
        Insert: {
          city: string
          computed_at?: string
          created_at?: string
          curated_by?: string | null
          garage_count?: number
          headline?: string
          hot_topics?: string[]
          local_signal?: string
          post_count?: number
          slug: string
          state?: string
          summary?: string
          top_brands?: string[]
          updated_at?: string
        }
        Update: {
          city?: string
          computed_at?: string
          created_at?: string
          curated_by?: string | null
          garage_count?: number
          headline?: string
          hot_topics?: string[]
          local_signal?: string
          post_count?: number
          slug?: string
          state?: string
          summary?: string
          top_brands?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      city_follows: {
        Row: {
          city_slug: string
          created_at: string
          notify: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          city_slug: string
          created_at?: string
          notify?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          city_slug?: string
          created_at?: string
          notify?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "city_follows_city_slug_fkey"
            columns: ["city_slug"]
            isOneToOne: false
            referencedRelation: "city_circles"
            referencedColumns: ["slug"]
          },
        ]
      }
      feedback_entries: {
        Row: {
          created_at: string
          id: string
          loop_stage: string
          message: string
          status: string
          surface: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          loop_stage?: string
          message: string
          status?: string
          surface?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          loop_stage?: string
          message?: string
          status?: string
          surface?: string
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
      garage_costs: {
        Row: {
          amount_inr: number
          category: string
          created_at: string
          id: string
          incurred_on: string
          note: string
          odometer_km: number
          timeline_entry_id: string | null
          title: string
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          amount_inr?: number
          category: string
          created_at?: string
          id: string
          incurred_on: string
          note?: string
          odometer_km?: number
          timeline_entry_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          amount_inr?: number
          category?: string
          created_at?: string
          id?: string
          incurred_on?: string
          note?: string
          odometer_km?: number
          timeline_entry_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_costs_timeline_entry_id_fkey"
            columns: ["timeline_entry_id"]
            isOneToOne: false
            referencedRelation: "timeline_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_costs_vehicle_id_user_id_fkey"
            columns: ["vehicle_id", "user_id"]
            isOneToOne: false
            referencedRelation: "garage_vehicles"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      garage_reminders: {
        Row: {
          completed_at: string | null
          created_at: string
          detail: string
          due_date: string | null
          due_odometer_km: number | null
          id: string
          kind: string
          last_notified_at: string | null
          status: string
          title: string
          updated_at: string
          urgency: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          detail?: string
          due_date?: string | null
          due_odometer_km?: number | null
          id: string
          kind?: string
          last_notified_at?: string | null
          status?: string
          title: string
          updated_at?: string
          urgency?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          detail?: string
          due_date?: string | null
          due_odometer_km?: number | null
          id?: string
          kind?: string
          last_notified_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          urgency?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_reminders_vehicle_id_user_id_fkey"
            columns: ["vehicle_id", "user_id"]
            isOneToOne: false
            referencedRelation: "garage_vehicles"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      garage_vehicles: {
        Row: {
          brand: string
          city: string
          created_at: string
          deleted_at: string | null
          fuel: string | null
          id: string
          model: string
          nickname: string
          odometer_km: number
          ownership: string | null
          purchase_month: string
          transmission: string | null
          updated_at: string
          user_id: string
          variant: string
        }
        Insert: {
          brand: string
          city?: string
          created_at?: string
          deleted_at?: string | null
          fuel?: string | null
          id: string
          model: string
          nickname?: string
          odometer_km?: number
          ownership?: string | null
          purchase_month?: string
          transmission?: string | null
          updated_at?: string
          user_id: string
          variant?: string
        }
        Update: {
          brand?: string
          city?: string
          created_at?: string
          deleted_at?: string | null
          fuel?: string | null
          id?: string
          model?: string
          nickname?: string
          odometer_km?: number
          ownership?: string | null
          purchase_month?: string
          transmission?: string | null
          updated_at?: string
          user_id?: string
          variant?: string
        }
        Relationships: []
      }
      inspection_items: {
        Row: {
          checked_at: string | null
          checklist_item_id: string
          created_at: string
          detail: string
          id: string
          note: string
          priority: string
          session_id: string
          state: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checked_at?: string | null
          checklist_item_id: string
          created_at?: string
          detail?: string
          id: string
          note?: string
          priority?: string
          session_id: string
          state?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checked_at?: string | null
          checklist_item_id?: string
          created_at?: string
          detail?: string
          id?: string
          note?: string
          priority?: string
          session_id?: string
          state?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_items_session_id_user_id_fkey"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "inspection_sessions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      inspection_sessions: {
        Row: {
          brand: string
          city: string
          completed_at: string | null
          created_at: string
          id: string
          model: string
          notes: string
          odometer_km: number
          shortlist_item_id: string | null
          status: string
          updated_at: string
          user_id: string
          variant: string
          verdict: string
        }
        Insert: {
          brand: string
          city?: string
          completed_at?: string | null
          created_at?: string
          id: string
          model: string
          notes?: string
          odometer_km?: number
          shortlist_item_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          variant?: string
          verdict?: string
        }
        Update: {
          brand?: string
          city?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          model?: string
          notes?: string
          odometer_km?: number
          shortlist_item_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          variant?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_sessions_shortlist_item_id_fkey"
            columns: ["shortlist_item_id"]
            isOneToOne: false
            referencedRelation: "shortlist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      model_playbooks: {
        Row: {
          brand: string
          buyer_checks: string[]
          computed_at: string
          confidence: string
          corroborations: number
          created_at: string
          curated_by: string | null
          evidence_count: number
          headline: string
          id: string
          model: string
          owner_signals: string[]
          updated_at: string
        }
        Insert: {
          brand: string
          buyer_checks?: string[]
          computed_at?: string
          confidence?: string
          corroborations?: number
          created_at?: string
          curated_by?: string | null
          evidence_count?: number
          headline?: string
          id: string
          model: string
          owner_signals?: string[]
          updated_at?: string
        }
        Update: {
          brand?: string
          buyer_checks?: string[]
          computed_at?: string
          confidence?: string
          corroborations?: number
          created_at?: string
          curated_by?: string | null
          evidence_count?: number
          headline?: string
          id?: string
          model?: string
          owner_signals?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          channel: string
          created_at: string
          delivered_at: string
          detail: string
          id: string
          job_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          delivered_at?: string
          detail?: string
          id?: string
          job_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          delivered_at?: string
          detail?: string
          id?: string
          job_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_job_id_user_id_fkey"
            columns: ["job_id", "user_id"]
            isOneToOne: false
            referencedRelation: "notification_jobs"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      notification_jobs: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          delivered_at: string | null
          id: string
          kind: string
          last_error: string
          payload: Json
          scheduled_for: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          channel?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          kind: string
          last_error?: string
          payload?: Json
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          kind?: string
          last_error?: string
          payload?: Json
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      owner_posts: {
        Row: {
          author: string
          body: string
          brand: string
          city: string
          comment_count: number
          created_at: string
          fixes_confirmed: number
          fuel: string | null
          helpful: number
          id: string
          label: string
          last_ranked_at: string | null
          model: string
          odometer_km: number
          quality_grade: string
          quality_score: number
          ranking_score: number
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
          comment_count?: number
          created_at?: string
          fixes_confirmed?: number
          fuel?: string | null
          helpful?: number
          id: string
          label: string
          last_ranked_at?: string | null
          model: string
          odometer_km?: number
          quality_grade?: string
          quality_score?: number
          ranking_score?: number
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
          comment_count?: number
          created_at?: string
          fixes_confirmed?: number
          fuel?: string | null
          helpful?: number
          id?: string
          label?: string
          last_ranked_at?: string | null
          model?: string
          odometer_km?: number
          quality_grade?: string
          quality_score?: number
          ranking_score?: number
          title?: string
          topic?: string
          updated_at?: string
          user_id?: string
          variant?: string
        }
        Relationships: []
      }
      playbook_entries: {
        Row: {
          confidence: string
          corroborations: number
          created_at: string
          detail: string
          evidence_count: number
          id: string
          kind: string
          playbook_id: string
          source_post_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: string
          corroborations?: number
          created_at?: string
          detail?: string
          evidence_count?: number
          id?: string
          kind: string
          playbook_id: string
          source_post_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: string
          corroborations?: number
          created_at?: string
          detail?: string
          evidence_count?: number
          id?: string
          kind?: string
          playbook_id?: string
          source_post_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_entries_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "model_playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_entries_source_post_id_fkey"
            columns: ["source_post_id"]
            isOneToOne: false
            referencedRelation: "owner_posts"
            referencedColumns: ["id"]
          },
        ]
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
      post_quality_scores: {
        Row: {
          components: Json
          computed_at: string
          created_at: string
          grade: string
          max_score: number
          missing_prompts: string[]
          post_id: string
          ranking_score: number
          score: number
          strengths: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          components?: Json
          computed_at?: string
          created_at?: string
          grade?: string
          max_score?: number
          missing_prompts?: string[]
          post_id: string
          ranking_score?: number
          score?: number
          strengths?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          components?: Json
          computed_at?: string
          created_at?: string
          grade?: string
          max_score?: number
          missing_prompts?: string[]
          post_id?: string
          ranking_score?: number
          score?: number
          strengths?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_quality_scores_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
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
  public: {
    Enums: {},
  },
} as const
