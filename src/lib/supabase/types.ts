export type CreationStatus = 'pending' | 'published' | 'rejected' | 'archived';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface CreationRow {
  id: string;
  slug: string;
  locale: string;
  status: CreationStatus;
  submitted_at: string;
  submitted_by: string | null;
  character_name: string;
  place_description: string | null;
  reason_description: string | null;
  action_description: string | null;
  appearance_description: string | null;
  story: string | null;
  stage_prompt: string | null;
  character_prompt: string | null;
  composite_instruction: string | null;
  thumbnail_path: string | null;
  composite_path: string | null;
  stage_image_path: string | null;
  character_image_path: string | null;
  model_glb_path: string | null;
  model_usdz_path: string | null;
  emotion_joy: number;
  emotion_trust: number;
  emotion_fear: number;
  emotion_surprise: number;
  emotion_sadness: number;
  emotion_disgust: number;
  emotion_anger: number;
  emotion_anticipation: number;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  metadata: Json;
  published_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  moderation_notes: string | null;
  assets_version: number;
  deleted_at: string | null;
}

export type CreationInsert = {
  id?: string;
  slug: string;
  locale?: string;
  status?: CreationStatus;
  submitted_at?: string;
  submitted_by?: string | null;
  character_name: string;
  place_description?: string | null;
  reason_description?: string | null;
  action_description?: string | null;
  appearance_description?: string | null;
  story?: string | null;
  stage_prompt?: string | null;
  character_prompt?: string | null;
  composite_instruction?: string | null;
  thumbnail_path?: string | null;
  composite_path?: string | null;
  stage_image_path?: string | null;
  character_image_path?: string | null;
  model_glb_path?: string | null;
  model_usdz_path?: string | null;
  emotion_joy?: number;
  emotion_trust?: number;
  emotion_fear?: number;
  emotion_surprise?: number;
  emotion_sadness?: number;
  emotion_disgust?: number;
  emotion_anger?: number;
  emotion_anticipation?: number;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  metadata?: Json;
  published_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  moderation_notes?: string | null;
  assets_version?: number;
  deleted_at?: string | null;
};

export type CreationUpdate = Partial<CreationInsert>;

export interface CreationAssetRow {
  id: string;
  creation_id: string;
  kind: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  checksum: string | null;
  created_at: string;
  updated_at: string;
}

export type CreationAssetInsert = {
  id?: string;
  creation_id: string;
  kind: string;
  storage_path: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  checksum?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CreationAssetUpdate = Partial<CreationAssetInsert>;

export interface ReviewerRow {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  display_name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export type ReviewerInsert = {
  id?: string;
  auth_user_id?: string | null;
  email?: string | null;
  display_name?: string | null;
  role?: string;
  created_at?: string;
  updated_at?: string;
};

export type ReviewerUpdate = Partial<ReviewerInsert>;

export interface Database {
  public: {
    Tables: {
      creations: {
        Row: CreationRow;
        Insert: CreationInsert;
        Update: CreationUpdate;
        Relationships: [
          {
            foreignKeyName: 'creations_reviewed_by_fkey' | null;
            columns: ['reviewed_by'];
            referencedRelation: 'reviewers';
            referencedColumns: ['id'];
          }
        ];
      };
      creation_assets: {
        Row: CreationAssetRow;
        Insert: CreationAssetInsert;
        Update: CreationAssetUpdate;
        Relationships: [
          {
            foreignKeyName: 'creation_assets_creation_id_fkey';
            columns: ['creation_id'];
            referencedRelation: 'creations';
            referencedColumns: ['id'];
          }
        ];
      };
      reviewers: {
        Row: ReviewerRow;
        Insert: ReviewerInsert;
        Update: ReviewerUpdate;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      creation_status: CreationStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
