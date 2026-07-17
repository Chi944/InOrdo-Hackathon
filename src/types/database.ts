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
      action_proposals: {
        Row: {
          change_event_id: string
          created_at: string
          created_by: string
          id: string
          impact_run_id: string | null
          model_name: string | null
          project_id: string
          rationale: string
          state: Database["public"]["Enums"]["proposal_state"]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          change_event_id: string
          created_at?: string
          created_by: string
          id?: string
          impact_run_id?: string | null
          model_name?: string | null
          project_id: string
          rationale: string
          state?: Database["public"]["Enums"]["proposal_state"]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          change_event_id?: string
          created_at?: string
          created_by?: string
          id?: string
          impact_run_id?: string | null
          model_name?: string | null
          project_id?: string
          rationale?: string
          state?: Database["public"]["Enums"]["proposal_state"]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_proposals_change_fk"
            columns: ["workspace_id", "project_id", "change_event_id"]
            isOneToOne: false
            referencedRelation: "change_events"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
          {
            foreignKeyName: "action_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_proposals_impact_fk"
            columns: ["workspace_id", "project_id", "impact_run_id"]
            isOneToOne: false
            referencedRelation: "impact_runs"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
          {
            foreignKeyName: "action_proposals_project_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      activity_events: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          project_id: string
          summary: string
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          project_id: string
          summary: string
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          project_id?: string
          summary?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_project_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      change_events: {
        Row: {
          confidence: number | null
          created_at: string
          created_by: string
          field_name: string
          id: string
          model_name: string | null
          previous_value: Json | null
          project_id: string
          proposed_value: Json
          reviewed_at: string | null
          reviewed_by: string | null
          source_document_id: string
          state: Database["public"]["Enums"]["change_event_state"]
          subject_item_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          created_by: string
          field_name: string
          id?: string
          model_name?: string | null
          previous_value?: Json | null
          project_id: string
          proposed_value: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_document_id: string
          state?: Database["public"]["Enums"]["change_event_state"]
          subject_item_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          created_by?: string
          field_name?: string
          id?: string
          model_name?: string | null
          previous_value?: Json | null
          project_id?: string
          proposed_value?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_document_id?: string
          state?: Database["public"]["Enums"]["change_event_state"]
          subject_item_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_events_item_fk"
            columns: ["workspace_id", "project_id", "subject_item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
          {
            foreignKeyName: "change_events_project_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "change_events_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_events_source_fk"
            columns: ["workspace_id", "project_id", "source_document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
        ]
      }
      impact_items: {
        Row: {
          created_at: string
          depth: number
          explanation: string
          id: string
          impact_run_id: string
          item_id: string
          path_item_ids: string[]
          project_id: string
          severity: Database["public"]["Enums"]["impact_severity"]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          depth: number
          explanation: string
          id?: string
          impact_run_id: string
          item_id: string
          path_item_ids: string[]
          project_id: string
          severity: Database["public"]["Enums"]["impact_severity"]
          workspace_id: string
        }
        Update: {
          created_at?: string
          depth?: number
          explanation?: string
          id?: string
          impact_run_id?: string
          item_id?: string
          path_item_ids?: string[]
          project_id?: string
          severity?: Database["public"]["Enums"]["impact_severity"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_items_item_fk"
            columns: ["workspace_id", "project_id", "item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
          {
            foreignKeyName: "impact_items_project_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "impact_items_run_fk"
            columns: ["workspace_id", "project_id", "impact_run_id"]
            isOneToOne: false
            referencedRelation: "impact_runs"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
        ]
      }
      impact_runs: {
        Row: {
          change_event_id: string
          completed_at: string | null
          error_message: string | null
          id: string
          max_depth: number
          project_id: string
          started_at: string
          started_by: string
          state: Database["public"]["Enums"]["impact_run_state"]
          workspace_id: string
        }
        Insert: {
          change_event_id: string
          completed_at?: string | null
          error_message?: string | null
          id?: string
          max_depth?: number
          project_id: string
          started_at?: string
          started_by: string
          state?: Database["public"]["Enums"]["impact_run_state"]
          workspace_id: string
        }
        Update: {
          change_event_id?: string
          completed_at?: string | null
          error_message?: string | null
          id?: string
          max_depth?: number
          project_id?: string
          started_at?: string
          started_by?: string
          state?: Database["public"]["Enums"]["impact_run_state"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_runs_change_fk"
            columns: ["workspace_id", "project_id", "change_event_id"]
            isOneToOne: false
            referencedRelation: "change_events"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
          {
            foreignKeyName: "impact_runs_project_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "impact_runs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_dependencies: {
        Row: {
          created_at: string
          created_by: string
          from_item_id: string
          id: string
          project_id: string
          rationale: string | null
          relationship: Database["public"]["Enums"]["dependency_relationship"]
          to_item_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          from_item_id: string
          id?: string
          project_id: string
          rationale?: string | null
          relationship?: Database["public"]["Enums"]["dependency_relationship"]
          to_item_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          from_item_id?: string
          id?: string
          project_id?: string
          rationale?: string | null
          relationship?: Database["public"]["Enums"]["dependency_relationship"]
          to_item_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_dependencies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_dependencies_from_fk"
            columns: ["workspace_id", "project_id", "from_item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
          {
            foreignKeyName: "item_dependencies_project_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "item_dependencies_to_fk"
            columns: ["workspace_id", "project_id", "to_item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
        ]
      }
      operation_items: {
        Row: {
          after_state: Json | null
          before_state: Json | null
          created_at: string
          error_message: string | null
          expected_item_version: number | null
          id: string
          item_id: string | null
          operation_id: string
          ordinal: number
          project_id: string
          proposal_action_id: string | null
          resulting_item_version: number | null
          reverse_payload: Json | null
          reversible: boolean
          state: Database["public"]["Enums"]["operation_item_state"]
          workspace_id: string
        }
        Insert: {
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          error_message?: string | null
          expected_item_version?: number | null
          id?: string
          item_id?: string | null
          operation_id: string
          ordinal: number
          project_id: string
          proposal_action_id?: string | null
          resulting_item_version?: number | null
          reverse_payload?: Json | null
          reversible?: boolean
          state: Database["public"]["Enums"]["operation_item_state"]
          workspace_id: string
        }
        Update: {
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          error_message?: string | null
          expected_item_version?: number | null
          id?: string
          item_id?: string | null
          operation_id?: string
          ordinal?: number
          project_id?: string
          proposal_action_id?: string | null
          resulting_item_version?: number | null
          reverse_payload?: Json | null
          reversible?: boolean
          state?: Database["public"]["Enums"]["operation_item_state"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_items_action_fk"
            columns: ["workspace_id", "project_id", "proposal_action_id"]
            isOneToOne: false
            referencedRelation: "proposal_actions"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
          {
            foreignKeyName: "operation_items_item_fk"
            columns: ["workspace_id", "project_id", "item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
          {
            foreignKeyName: "operation_items_operation_fk"
            columns: ["workspace_id", "project_id", "operation_id"]
            isOneToOne: false
            referencedRelation: "operation_logs"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
          {
            foreignKeyName: "operation_items_project_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      operation_logs: {
        Row: {
          completed_at: string
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string
          initiated_by: string
          operation_type: Database["public"]["Enums"]["operation_type"]
          project_id: string
          proposal_id: string | null
          reverses_operation_id: string | null
          state: Database["public"]["Enums"]["operation_state"]
          workspace_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key: string
          initiated_by: string
          operation_type: Database["public"]["Enums"]["operation_type"]
          project_id: string
          proposal_id?: string | null
          reverses_operation_id?: string | null
          state: Database["public"]["Enums"]["operation_state"]
          workspace_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string
          initiated_by?: string
          operation_type?: Database["public"]["Enums"]["operation_type"]
          project_id?: string
          proposal_id?: string | null
          reverses_operation_id?: string | null
          state?: Database["public"]["Enums"]["operation_state"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_logs_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_logs_project_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "operation_logs_proposal_fk"
            columns: ["workspace_id", "project_id", "proposal_id"]
            isOneToOne: false
            referencedRelation: "action_proposals"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
          {
            foreignKeyName: "operation_logs_reverse_fk"
            columns: ["workspace_id", "project_id", "reverses_operation_id"]
            isOneToOne: false
            referencedRelation: "operation_logs"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_items: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          event_date: string | null
          id: string
          item_key: string
          item_type: Database["public"]["Enums"]["project_item_type"]
          metadata: Json
          owner_id: string | null
          priority: Database["public"]["Enums"]["item_priority"]
          project_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_item_status"]
          title: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          event_date?: string | null
          id?: string
          item_key: string
          item_type: Database["public"]["Enums"]["project_item_type"]
          metadata?: Json
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["item_priority"]
          project_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_item_status"]
          title: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          event_date?: string | null
          id?: string
          item_key?: string
          item_type?: Database["public"]["Enums"]["project_item_type"]
          metadata?: Json
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["item_priority"]
          project_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_item_status"]
          title?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_items_project_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_demo: boolean
          name: string
          slug: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name: string
          slug: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["proposal_action_type"]
          created_at: string
          expected_item_version: number | null
          id: string
          ordinal: number
          payload: Json
          project_id: string
          proposal_id: string
          rationale: string
          reviewed_at: string | null
          reviewed_by: string | null
          state: Database["public"]["Enums"]["proposal_action_state"]
          target_item_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["proposal_action_type"]
          created_at?: string
          expected_item_version?: number | null
          id?: string
          ordinal: number
          payload: Json
          project_id: string
          proposal_id: string
          rationale: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: Database["public"]["Enums"]["proposal_action_state"]
          target_item_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["proposal_action_type"]
          created_at?: string
          expected_item_version?: number | null
          id?: string
          ordinal?: number
          payload?: Json
          project_id?: string
          proposal_id?: string
          rationale?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: Database["public"]["Enums"]["proposal_action_state"]
          target_item_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_actions_item_fk"
            columns: ["workspace_id", "project_id", "target_item_id"]
            isOneToOne: false
            referencedRelation: "project_items"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
          {
            foreignKeyName: "proposal_actions_project_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "proposal_actions_proposal_fk"
            columns: ["workspace_id", "project_id", "proposal_id"]
            isOneToOne: false
            referencedRelation: "action_proposals"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
          {
            foreignKeyName: "proposal_actions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      source_documents: {
        Row: {
          captured_by: string
          content_sha256: string | null
          created_at: string
          id: string
          occurred_at: string | null
          project_id: string
          raw_text: string
          source_kind: string
          source_url: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          captured_by: string
          content_sha256?: string | null
          created_at?: string
          id?: string
          occurred_at?: string | null
          project_id: string
          raw_text: string
          source_kind: string
          source_url?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          captured_by?: string
          content_sha256?: string | null
          created_at?: string
          id?: string
          occurred_at?: string | null
          project_id?: string
          raw_text?: string
          source_kind?: string
          source_url?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_documents_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_documents_project_fk"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          invited_by: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      change_event_state:
        | "needs_confirmation"
        | "confirmed"
        | "rejected"
        | "superseded"
      dependency_relationship:
        | "depends_on"
        | "requires"
        | "informs"
        | "scheduled_by"
      impact_run_state: "pending" | "completed" | "failed"
      impact_severity: "low" | "medium" | "high" | "critical"
      item_priority: "low" | "medium" | "high" | "critical"
      operation_item_state: "succeeded" | "failed" | "skipped"
      operation_state: "succeeded" | "failed"
      operation_type: "apply_proposal" | "undo" | "demo_reset"
      project_item_status:
        | "not_started"
        | "in_progress"
        | "blocked"
        | "at_risk"
        | "completed"
        | "cancelled"
      project_item_type:
        | "task"
        | "milestone"
        | "decision"
        | "event"
        | "risk"
        | "artifact"
      project_status: "active" | "paused" | "completed" | "archived"
      proposal_action_state:
        | "pending"
        | "approved"
        | "rejected"
        | "applied"
        | "stale"
      proposal_action_type:
        | "update_item"
        | "create_item"
        | "add_dependency"
        | "remove_dependency"
      proposal_state:
        | "draft"
        | "ready"
        | "partially_approved"
        | "approved"
        | "applied"
        | "rejected"
        | "superseded"
      workspace_role: "owner" | "admin" | "member" | "viewer"
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
      change_event_state: [
        "needs_confirmation",
        "confirmed",
        "rejected",
        "superseded",
      ],
      dependency_relationship: [
        "depends_on",
        "requires",
        "informs",
        "scheduled_by",
      ],
      impact_run_state: ["pending", "completed", "failed"],
      impact_severity: ["low", "medium", "high", "critical"],
      item_priority: ["low", "medium", "high", "critical"],
      operation_item_state: ["succeeded", "failed", "skipped"],
      operation_state: ["succeeded", "failed"],
      operation_type: ["apply_proposal", "undo", "demo_reset"],
      project_item_status: [
        "not_started",
        "in_progress",
        "blocked",
        "at_risk",
        "completed",
        "cancelled",
      ],
      project_item_type: [
        "task",
        "milestone",
        "decision",
        "event",
        "risk",
        "artifact",
      ],
      project_status: ["active", "paused", "completed", "archived"],
      proposal_action_state: [
        "pending",
        "approved",
        "rejected",
        "applied",
        "stale",
      ],
      proposal_action_type: [
        "update_item",
        "create_item",
        "add_dependency",
        "remove_dependency",
      ],
      proposal_state: [
        "draft",
        "ready",
        "partially_approved",
        "approved",
        "applied",
        "rejected",
        "superseded",
      ],
      workspace_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const
