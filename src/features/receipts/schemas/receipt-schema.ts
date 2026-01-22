import { z } from "zod";

/**
 * Receipt Update Schema
 *
 * Production-grade Zod validation schema for the Edit Receipt feature.
 * Acts as the contract between Client Form and Server Action.
 *
 * Key Considerations:
 * - Uses `z.coerce` for numbers to handle HTML input string→number conversion
 * - Transforms empty date strings to null for valid Postgres NULL
 * - Thai language error messages for user-friendly UX
 */

/**
 * Valid receipt status values (must match DB enum)
 */
export const RECEIPT_STATUS = ["pending", "completed", "failed"] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUS)[number];

/**
 * Update Receipt Schema
 *
 * Validates form input before server action execution.
 * Field names must match the database column names exactly.
 */
export const updateReceiptSchema = z.object({
    // Primary key - required for update operations
    id: z.string().uuid({ message: "รหัสใบเสร็จไม่ถูกต้อง" }),

    // Supplier name - required field
    supplier_name: z
        .string()
        .min(1, { message: "กรุณาระบุชื่อร้านค้า" })
        .max(255, { message: "ชื่อร้านค้ายาวเกินไป (สูงสุด 255 ตัวอักษร)" }),

    // Transaction date - converts empty string to null for Postgres
    transaction_date: z
        .string()
        .optional()
        .or(z.literal(""))
        .transform((val) => {
            // Convert empty string or undefined to null
            if (!val || val === "") return null;
            // Validate ISO date format if provided
            const parsed = new Date(val);
            if (isNaN(parsed.getTime())) return null;
            return val; // Return the original ISO string
        }),

    // Total amount - must be non-negative
    total_amount: z.coerce
        .number({ invalid_type_error: "กรุณาระบุยอดเงินเป็นตัวเลข" })
        .min(0, { message: "ยอดเงินต้องไม่ติดลบ" })
        .optional()
        .nullable(),

    // Weight in kilograms - must be non-negative
    weight_kg: z.coerce
        .number({ invalid_type_error: "กรุณาระบุน้ำหนักเป็นตัวเลข" })
        .min(0, { message: "น้ำหนักต้องไม่ติดลบ" })
        .optional()
        .nullable(),

    // Price per kilogram - must be non-negative
    price_per_kg: z.coerce
        .number({ invalid_type_error: "กรุณาระบุราคาต่อหน่วยเป็นตัวเลข" })
        .min(0, { message: "ราคาต่อหน่วยต้องไม่ติดลบ" })
        .optional()
        .nullable(),

    // Receipt processing status
    status: z.enum(RECEIPT_STATUS, {
        errorMap: () => ({ message: "สถานะไม่ถูกต้อง" }),
    }),
});

/**
 * Type inference for Update Receipt form input
 * Use this type for form state and server action parameters
 */
export type UpdateReceiptInput = z.infer<typeof updateReceiptSchema>;

/**
 * Partial update schema (for PATCH operations)
 * All fields except ID are optional
 */
export const partialUpdateReceiptSchema = updateReceiptSchema.partial().extend({
    id: z.string().uuid({ message: "รหัสใบเสร็จไม่ถูกต้อง" }), // ID is always required
});

export type PartialUpdateReceiptInput = z.infer<typeof partialUpdateReceiptSchema>;
