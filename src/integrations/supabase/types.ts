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
      announcements: {
        Row: {
          body: string
          body_es: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          pinned: boolean
          show_on_tv: boolean
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          body_es?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          pinned?: boolean
          show_on_tv?: boolean
          starts_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          body_es?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          pinned?: boolean
          show_on_tv?: boolean
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      approved_viewers: {
        Row: {
          added_at: string
          added_by: string | null
          email: string
          id: string
          last_seen_at: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          email: string
          id?: string
          last_seen_at?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          email?: string
          id?: string
          last_seen_at?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: number
          meta: Json
          target: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: number
          meta?: Json
          target?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: number
          meta?: Json
          target?: string | null
        }
        Relationships: []
      }
      collection_subscriptions: {
        Row: {
          collection_id: string
          created_at: string
          notify: boolean
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          notify?: boolean
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          notify?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_subscriptions_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          guests: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          guests?: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          guests?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          location: string | null
          published: boolean
          rsvp_enabled: boolean
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          published?: boolean
          rsvp_enabled?: boolean
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          published?: boolean
          rsvp_enabled?: boolean
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      form_submissions: {
        Row: {
          created_at: string
          data: Json
          form_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          form_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          form_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          published: boolean
          schema: Json
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          published?: boolean
          schema?: Json
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          published?: boolean
          schema?: Json
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "small_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      hymns: {
        Row: {
          audio_url: string | null
          author: string | null
          bunny_video_id: string | null
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          lyrics: string
          lyrics_es: string | null
          number: number | null
          title: string
          title_es: string | null
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          author?: string | null
          bunny_video_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lyrics?: string
          lyrics_es?: string | null
          number?: number | null
          title: string
          title_es?: string | null
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          author?: string | null
          bunny_video_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lyrics?: string
          lyrics_es?: string | null
          number?: number | null
          title?: string
          title_es?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          bunny_video_id: string | null
          collection_id: string | null
          created_at: string
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          bunny_video_id?: string | null
          collection_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          bunny_video_id?: string | null
          collection_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      playlist_items: {
        Row: {
          added_at: string
          bunny_video_id: string
          playlist_id: string
          position: number
        }
        Insert: {
          added_at?: string
          bunny_video_id: string
          playlist_id: string
          position?: number
        }
        Update: {
          added_at?: string
          bunny_video_id?: string
          playlist_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          is_watch_later: boolean
          name: string
          share_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          is_watch_later?: boolean
          name: string
          share_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          is_watch_later?: boolean
          name?: string
          share_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plugin_states: {
        Row: {
          enabled: boolean
          id: string
          settings: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          id: string
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          id?: string
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      prayer_intercessions: {
        Row: {
          created_at: string
          prayer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          prayer_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          prayer_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_intercessions_prayer_id_fkey"
            columns: ["prayer_id"]
            isOneToOne: false
            referencedRelation: "prayer_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_requests: {
        Row: {
          answered: boolean
          body: string
          created_at: string
          id: string
          is_anonymous: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answered?: boolean
          body?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answered?: boolean
          body?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          key: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          key: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      rota_assignments: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          person_name: string | null
          plan_id: string | null
          role_id: string
          serve_date: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          person_name?: string | null
          plan_id?: string | null
          role_id: string
          serve_date: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          person_name?: string | null
          plan_id?: string | null
          role_id?: string
          serve_date?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rota_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "rota_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      rota_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      service_items: {
        Row: {
          bunny_video_id: string | null
          created_at: string
          detail: string | null
          duration_minutes: number | null
          hymn_id: string | null
          id: string
          kind: string
          plan_id: string
          position: number
          title: string
        }
        Insert: {
          bunny_video_id?: string | null
          created_at?: string
          detail?: string | null
          duration_minutes?: number | null
          hymn_id?: string | null
          id?: string
          kind?: string
          plan_id: string
          position?: number
          title: string
        }
        Update: {
          bunny_video_id?: string | null
          created_at?: string
          detail?: string | null
          duration_minutes?: number | null
          hymn_id?: string | null
          id?: string
          kind?: string
          plan_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_items_hymn_id_fkey"
            columns: ["hymn_id"]
            isOneToOne: false
            referencedRelation: "hymns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      service_plans: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          published: boolean
          service_date: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          published?: boolean
          service_date: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          published?: boolean
          service_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
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
      share_links: {
        Row: {
          access_mode: string
          bunny_video_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          label: string | null
          max_views: number | null
          password_hash: string | null
          password_salt: string | null
          recipient_email: string | null
          revoked_at: string | null
          token: string
          view_count: number
          viewed_at: string | null
        }
        Insert: {
          access_mode?: string
          bunny_video_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          label?: string | null
          max_views?: number | null
          password_hash?: string | null
          password_salt?: string | null
          recipient_email?: string | null
          revoked_at?: string | null
          token: string
          view_count?: number
          viewed_at?: string | null
        }
        Update: {
          access_mode?: string
          bunny_video_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          label?: string | null
          max_views?: number | null
          password_hash?: string | null
          password_salt?: string | null
          recipient_email?: string | null
          revoked_at?: string | null
          token?: string
          view_count?: number
          viewed_at?: string | null
        }
        Relationships: []
      }
      share_privileges: {
        Row: {
          can_share: boolean
          can_share_public: boolean
          created_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          can_share?: boolean
          can_share_public?: boolean
          created_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          can_share?: boolean
          can_share_public?: boolean
          created_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      small_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_open: boolean
          leader_id: string | null
          meeting_info: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_open?: boolean
          leader_id?: string | null
          meeting_info?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_open?: boolean
          leader_id?: string | null
          meeting_info?: string | null
          name?: string
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
      video_chapters: {
        Row: {
          bunny_video_id: string
          created_at: string
          id: string
          label: string
          start_seconds: number
          updated_at: string
        }
        Insert: {
          bunny_video_id: string
          created_at?: string
          id?: string
          label: string
          start_seconds?: number
          updated_at?: string
        }
        Update: {
          bunny_video_id?: string
          created_at?: string
          id?: string
          label?: string
          start_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      video_comments: {
        Row: {
          body: string
          bunny_video_id: string
          created_at: string
          deleted: boolean
          id: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          bunny_video_id: string
          created_at?: string
          deleted?: boolean
          id?: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          bunny_video_id?: string
          created_at?: string
          deleted?: boolean
          id?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "video_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      video_likes: {
        Row: {
          bunny_video_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          bunny_video_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          bunny_video_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_metadata: {
        Row: {
          bunny_video_id: string
          collection_id: string | null
          created_at: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          bunny_video_id: string
          collection_id?: string | null
          created_at?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          bunny_video_id?: string
          collection_id?: string | null
          created_at?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_metadata_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      video_views: {
        Row: {
          bunny_video_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          bunny_video_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          bunny_video_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      watch_progress: {
        Row: {
          bunny_video_id: string
          duration_seconds: number
          position_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bunny_video_id: string
          duration_seconds?: number
          position_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bunny_video_id?: string
          duration_seconds?: number
          position_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_share: { Args: { _user_id: string }; Returns: boolean }
      can_share_public: { Args: { _user_id: string }; Returns: boolean }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved_viewer: { Args: never; Returns: boolean }
      plugin_enabled: { Args: { _id: string }; Returns: boolean }
      public_playlist: {
        Args: { _token: string }
        Returns: {
          bunny_video_id: string
          item_position: number
          playlist_description: string
          playlist_id: string
          playlist_name: string
          title: string
        }[]
      }
      top_videos: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          bunny_video_id: string
          views: number
        }[]
      }
      video_view_counts: {
        Args: { _ids: string[] }
        Returns: {
          bunny_video_id: string
          views: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "staff" | "volunteer" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user", "staff", "volunteer", "member"],
    },
  },
} as const
