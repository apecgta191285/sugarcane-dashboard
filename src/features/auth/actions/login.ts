"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/**
 * Login Input Schema
 */
const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

/**
 * Login Action Result
 */
type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

/**
 * Login with Email and Password
 */
export async function login(
    formData: FormData
): Promise<ActionResult> {
    try {
        // Validate input
        const rawData = {
            email: formData.get("email"),
            password: formData.get("password"),
        };

        const validated = loginSchema.parse(rawData);

        // Get Supabase client
        const supabase = await createClient();

        // Attempt sign in
        const { data, error } = await supabase.auth.signInWithPassword({
            email: validated.email,
            password: validated.password,
        });

        if (error) {
            console.error("Login error:", error);
            return {
                success: false,
                error: error.message || "Failed to login",
            };
        }

        if (!data.user) {
            return {
                success: false,
                error: "Authentication failed - no user returned",
            };
        }

        // Revalidate and redirect
        revalidatePath("/", "layout");
        redirect("/dashboard");
    } catch (err) {
        if (err instanceof z.ZodError) {
            return {
                success: false,
                error: err.errors[0].message,
            };
        }

        // Don't catch redirect
        throw err;
    }
}
