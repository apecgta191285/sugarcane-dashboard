"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uploadFileSchema } from "../types/upload.types";

/**
 * Upload Result
 */
type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

/**
 * Upload Receipt Image and Create Database Record
 * 
 * CRITICAL: Uses authenticated user's ID from server-side session.
 * RLS policies verify that user_id matches the authenticated user.
 */
export async function uploadReceipt(
    formData: FormData
): Promise<ActionResult<{ receiptId: string }>> {
    try {
        // ===========================================
        // [1] AUTH CHECK - Get authenticated user
        // ===========================================
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return {
                success: false,
                error: "Unauthorized - Please login to upload receipts",
            };
        }

        // ===========================================
        // [2] VALIDATION - Validate file
        // ===========================================
        const file = formData.get("file") as File | null;

        if (!file) {
            return {
                success: false,
                error: "No file provided",
            };
        }

        const validationResult = uploadFileSchema.safeParse({ file });

        if (!validationResult.success) {
            return {
                success: false,
                error: validationResult.error.errors[0].message,
            };
        }

        // ===========================================
        // [3] STORAGE - Upload to Supabase Storage
        // ===========================================
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Convert File to ArrayBuffer for upload
        const fileBuffer = await file.arrayBuffer();

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from("receipts")
            .upload(fileName, fileBuffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error("Storage upload error:", uploadError);
            return {
                success: false,
                error: `Failed to upload file: ${uploadError.message}`,
            };
        }

        // Get public URL
        const {
            data: { publicUrl },
        } = supabase.storage.from("receipts").getPublicUrl(fileName);

        // ===========================================
        // [4] DATABASE - Create receipt record
        // ===========================================
        const { data: receipt, error: dbError } = await supabase
            .from("receipts")
            .insert({
                user_id: user.id, // CRITICAL: Secure server-side user ID
                status: "pending",
                image_url: publicUrl,
                image_filename: file.name,
            })
            .select("id")
            .single();

        if (dbError) {
            console.error("Database insert error:", dbError);

            // Cleanup: Delete uploaded file if database insert fails
            await supabase.storage.from("receipts").remove([fileName]);

            return {
                success: false,
                error: `Failed to create receipt record: ${dbError.message}`,
            };
        }

        // ===========================================
        // [5] REVALIDATE - Update UI cache
        // ===========================================
        revalidatePath("/receipts");
        revalidatePath("/dashboard");

        return {
            success: true,
            data: { receiptId: receipt.id },
        };
    } catch (err) {
        console.error("Upload error:", err);
        return {
            success: false,
            error: err instanceof Error ? err.message : "An unexpected error occurred",
        };
    }
}
