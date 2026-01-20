"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { analyzeReceipt, type OCRExtractedData } from "@/shared/lib/ai/client";
import { revalidatePath } from "next/cache";
import { uploadFileSchema } from "../types/upload.types";

/**
 * Upload Result
 */
type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

/**
 * Upload Receipt Image with AI-Powered OCR (via OpenRouter)
 * 
 * Pipeline:
 * 1. Auth Check
 * 2. Validate Input
 * 3. Convert Image to Base64
 * 4. Process with OpenRouter OCR (Gemini 2.0 Flash)
 * 5. Upload to Supabase Storage
 * 6. Insert Record with OCR Data
 * 7. Revalidate Cache
 * 
 * CRITICAL: Uses authenticated user's ID from server-side session.
 * RLS policies verify that user_id matches the authenticated user.
 */
export async function uploadReceipt(
    formData: FormData
): Promise<ActionResult<{ receiptId: string; ocrData?: OCRExtractedData }>> {
    const startTime = Date.now();

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
                error: validationResult.error.issues[0].message,
            };
        }

        // ===========================================
        // [3] CONVERT TO BASE64 - For OpenRouter Vision
        // ===========================================
        const fileBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(fileBuffer);
        const base64Image = buffer.toString("base64");

        // ===========================================
        // [4] AI OCR - Process with OpenRouter (Graceful Degradation)
        // ===========================================
        let ocrData: OCRExtractedData | null = null;
        let ocrError: string | null = null;
        let ocrConfidence: number | null = null;

        const ocrResult = await analyzeReceipt(base64Image, file.type);

        if (ocrResult.error) {
            console.warn("⚠️ OCR processing failed (non-fatal):", ocrResult.error);
            ocrError = ocrResult.error;
            // Continue with upload - status will remain 'pending' for manual review
        } else if (ocrResult.data) {
            ocrData = ocrResult.data;

            // Calculate confidence score based on how many fields were extracted
            const fields = ['supplier_name', 'date', 'total_amount', 'cane_type', 'weight_net', 'price_per_ton'];
            const filledFields = fields.filter(f => ocrData![f as keyof OCRExtractedData] !== null && ocrData![f as keyof OCRExtractedData] !== undefined);
            ocrConfidence = Math.round((filledFields.length / fields.length) * 100);

            console.log("✅ OCR extraction successful:", { filledFields: filledFields.length, confidence: ocrConfidence });
        }

        // ===========================================
        // [5] STORAGE - Upload to Supabase Storage
        // ===========================================
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from("receipts")
            .upload(fileName, buffer, {
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
        // [6] DATABASE - Create receipt record with OCR data
        // ===========================================
        const processingDuration = Date.now() - startTime;

        // Determine status based on OCR success and data quality
        let status: "pending" | "processing" | "completed" | "failed" = "pending";
        if (ocrData && ocrConfidence && ocrConfidence >= 50) {
            status = "completed";
        } else if (ocrData) {
            status = "processing"; // Needs review
        }

        const { data: receipt, error: dbError } = await supabase
            .from("receipts")
            .insert({
                user_id: user.id,
                status,
                image_url: publicUrl,
                image_filename: file.name,
                // OCR extracted fields
                supplier_name: ocrData?.supplier_name ?? null,
                transaction_date: ocrData?.date ?? null,
                total_amount: ocrData?.total_amount ?? null,
                weight_kg: ocrData?.weight_net ?? null,
                price_per_kg: ocrData?.price_per_ton ? ocrData.price_per_ton / 1000 : null, // Convert per ton to per kg
                // OCR metadata
                raw_ocr_data: ocrData ? JSON.parse(JSON.stringify(ocrData)) : null,
                ocr_confidence_score: ocrConfidence,
                processed_at: ocrData ? new Date().toISOString() : null,
                processing_duration_ms: processingDuration,
                error_message: ocrError,
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
        // [7] REVALIDATE - Update UI cache
        // ===========================================
        revalidatePath("/receipts");
        revalidatePath("/dashboard");

        return {
            success: true,
            data: {
                receiptId: receipt.id,
                ocrData: ocrData ?? undefined,
            },
        };
    } catch (err) {
        console.error("Upload error:", err);
        return {
            success: false,
            error: err instanceof Error ? err.message : "An unexpected error occurred",
        };
    }
}
