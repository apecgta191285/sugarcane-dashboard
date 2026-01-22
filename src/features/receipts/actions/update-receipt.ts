"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
    updateReceiptSchema,
    type UpdateReceiptInput,
} from "../schemas/receipt-schema";

/**
 * Server Action Response Type
 */
type ActionResponse =
    | { success: true }
    | { success: false; error: string; details?: Record<string, string[]> };

/**
 * Update Receipt Server Action
 *
 * Handles receipt update with validation, database operation, and cache invalidation.
 *
 * CRITICAL NOTES:
 * - redirect() is called OUTSIDE try-catch to avoid NEXT_REDIRECT interception
 * - Uses safeParse for Zod validation to return user-friendly errors
 * - Auto-sets status to 'completed' on successful update
 *
 * @param rawData - Form data to validate and persist
 * @returns ActionResponse with success status or error details
 */
export async function updateReceipt(
    rawData: unknown
): Promise<ActionResponse> {
    // =========================================
    // [1] VALIDATION - Parse and validate input
    // =========================================
    const validationResult = updateReceiptSchema.safeParse(rawData);

    if (!validationResult.success) {
        return {
            success: false,
            error: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
            details: validationResult.error.flatten().fieldErrors,
        };
    }

    const data: UpdateReceiptInput = validationResult.data;

    // =========================================
    // [2] DATABASE UPDATE - Inside try-catch
    // =========================================
    let shouldRedirect = false;

    try {
        const supabase = await createClient();

        // Verify user is authenticated
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return {
                success: false,
                error: "กรุณาเข้าสู่ระบบก่อนแก้ไขข้อมูล",
            };
        }

        // Perform update operation
        const { error: updateError } = await supabase
            .from("receipts")
            .update({
                supplier_name: data.supplier_name,
                transaction_date: data.transaction_date, // null-safe from schema transform
                total_amount: data.total_amount,
                weight_kg: data.weight_kg,
                price_per_kg: data.price_per_kg,
                status: "completed", // Auto-update status on manual edit
                updated_at: new Date().toISOString(),
            })
            .eq("id", data.id)
            .eq("user_id", user.id); // RLS: Ensure user owns this receipt

        if (updateError) {
            console.error("[updateReceipt] Supabase error:", updateError);
            throw updateError;
        }

        // =========================================
        // [3] CACHE INVALIDATION
        // =========================================
        revalidatePath("/dashboard");
        revalidatePath("/receipts");
        revalidatePath(`/receipts/${data.id}`);

        // Mark for redirect (will execute outside try-catch)
        shouldRedirect = true;

    } catch (error) {
        console.error("[updateReceipt] Unexpected error:", error);
        return {
            success: false,
            error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง",
        };
    }

    // =========================================
    // [4] REDIRECT - CRITICAL: Outside try-catch
    // =========================================
    // Next.js redirect() throws NEXT_REDIRECT internally.
    // If called inside try-catch, catch block intercepts it as an error.
    if (shouldRedirect) {
        redirect("/receipts");
    }

    // Fallback return (should not reach here due to redirect)
    return { success: true };
}

/**
 * Update Receipt without redirect (for AJAX/modal use cases)
 *
 * Same logic as updateReceipt but returns response instead of redirecting.
 * Useful for inline editing or modal forms that shouldn't navigate away.
 */
export async function updateReceiptInline(
    rawData: unknown
): Promise<ActionResponse> {
    // =========================================
    // [1] VALIDATION
    // =========================================
    const validationResult = updateReceiptSchema.safeParse(rawData);

    if (!validationResult.success) {
        return {
            success: false,
            error: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
            details: validationResult.error.flatten().fieldErrors,
        };
    }

    const data: UpdateReceiptInput = validationResult.data;

    // =========================================
    // [2] DATABASE UPDATE
    // =========================================
    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return {
                success: false,
                error: "กรุณาเข้าสู่ระบบก่อนแก้ไขข้อมูล",
            };
        }

        const { error: updateError } = await supabase
            .from("receipts")
            .update({
                supplier_name: data.supplier_name,
                transaction_date: data.transaction_date,
                total_amount: data.total_amount,
                weight_kg: data.weight_kg,
                price_per_kg: data.price_per_kg,
                status: "completed",
                updated_at: new Date().toISOString(),
            })
            .eq("id", data.id)
            .eq("user_id", user.id);

        if (updateError) {
            console.error("[updateReceiptInline] Supabase error:", updateError);
            throw updateError;
        }

        // =========================================
        // [3] CACHE INVALIDATION (no redirect)
        // =========================================
        revalidatePath("/dashboard");
        revalidatePath("/receipts");
        revalidatePath(`/receipts/${data.id}`);

        return { success: true };

    } catch (error) {
        console.error("[updateReceiptInline] Unexpected error:", error);
        return {
            success: false,
            error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง",
        };
    }
}
