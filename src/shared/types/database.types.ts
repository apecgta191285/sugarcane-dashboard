/**
 * Supabase Database Type Definitions
 * 
 * This file contains TypeScript types generated from the Supabase schema.
 * Update this file when the database schema changes.
 */

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type Database = {
    public: {
        Tables: {
            receipts: {
                Row: {
                    id: string;
                    user_id: string;
                    status: "pending" | "processing" | "completed" | "failed";
                    verification_status: "unverified" | "verified" | "corrected";
                    receipt_number: string | null;
                    transaction_date: string | null;
                    supplier_name: string | null;
                    weight_kg: number | null;
                    price_per_kg: number | null;
                    total_amount: number | null;
                    notes: string | null;
                    raw_ocr_data: Json | null;
                    ocr_confidence_score: number | null;
                    image_url: string;
                    image_filename: string | null;
                    processed_at: string | null;
                    processing_duration_ms: number | null;
                    error_message: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    status?: "pending" | "processing" | "completed" | "failed";
                    verification_status?: "unverified" | "verified" | "corrected";
                    receipt_number?: string | null;
                    transaction_date?: string | null;
                    supplier_name?: string | null;
                    weight_kg?: number | null;
                    price_per_kg?: number | null;
                    total_amount?: number | null;
                    notes?: string | null;
                    raw_ocr_data?: Json | null;
                    ocr_confidence_score?: number | null;
                    image_url: string;
                    image_filename?: string | null;
                    processed_at?: string | null;
                    processing_duration_ms?: number | null;
                    error_message?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    status?: "pending" | "processing" | "completed" | "failed";
                    verification_status?: "unverified" | "verified" | "corrected";
                    receipt_number?: string | null;
                    transaction_date?: string | null;
                    supplier_name?: string | null;
                    weight_kg?: number | null;
                    price_per_kg?: number | null;
                    total_amount?: number | null;
                    notes?: string | null;
                    raw_ocr_data?: Json | null;
                    ocr_confidence_score?: number | null;
                    image_url?: string;
                    image_filename?: string | null;
                    processed_at?: string | null;
                    processing_duration_ms?: number | null;
                    error_message?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "receipts_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    }
                ];
            };
            attachments: {
                Row: {
                    id: string;
                    receipt_id: string;
                    file_url: string;
                    file_name: string;
                    file_size_bytes: number | null;
                    mime_type: string | null;
                    sort_order: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    receipt_id: string;
                    file_url: string;
                    file_name: string;
                    file_size_bytes?: number | null;
                    mime_type?: string | null;
                    sort_order?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    receipt_id?: string;
                    file_url?: string;
                    file_name?: string;
                    file_size_bytes?: number | null;
                    mime_type?: string | null;
                    sort_order?: number;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "attachments_receipt_id_fkey";
                        columns: ["receipt_id"];
                        isOneToOne: false;
                        referencedRelation: "receipts";
                        referencedColumns: ["id"];
                    }
                ];
            };
        };
        Views: {
            receipt_summary: {
                Row: {
                    user_id: string;
                    total_receipts: number;
                    completed_receipts: number;
                    pending_receipts: number;
                    failed_receipts: number;
                    total_weight_kg: number | null;
                    total_revenue: number | null;
                    avg_price_per_kg: number | null;
                };
                Relationships: [];
            };
        };
        Functions: Record<string, never>;
        Enums: {
            receipt_status: "pending" | "processing" | "completed" | "failed";
            verification_status: "unverified" | "verified" | "corrected";
        };
        CompositeTypes: Record<string, never>;
    };
};

// Helper types for easier usage
export type Receipt = Database["public"]["Tables"]["receipts"]["Row"];
export type ReceiptInsert = Database["public"]["Tables"]["receipts"]["Insert"];
export type ReceiptUpdate = Database["public"]["Tables"]["receipts"]["Update"];
export type ReceiptStatus = Database["public"]["Enums"]["receipt_status"];
export type VerificationStatus = Database["public"]["Enums"]["verification_status"];

export type Attachment = Database["public"]["Tables"]["attachments"]["Row"];
export type AttachmentInsert = Database["public"]["Tables"]["attachments"]["Insert"];

export type ReceiptSummary = Database["public"]["Views"]["receipt_summary"]["Row"];
