import { z } from "zod";

/**
 * Upload File Schema
 * 
 * Validates file uploads for receipt images
 */
export const uploadFileSchema = z.object({
    file: z.instanceof(File, { message: "File is required" })
        .refine((file) => file.size <= 5 * 1024 * 1024, {
            message: "File size must be less than 5MB",
        })
        .refine(
            (file) => ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type),
            {
                message: "Only JPEG, PNG, and WebP images are allowed",
            }
        ),
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>;
