"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/**
 * Signup Input Schema
 */
const signupSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

/**
 * Signup Action Result
 */
type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

/**
 * Sign Up with Email and Password
 */
export async function signup(
    formData: FormData
): Promise<ActionResult> {
    try {
        // Validate input
        const rawData = {
            email: formData.get("email"),
            password: formData.get("password"),
            confirmPassword: formData.get("confirmPassword"),
        };

        const validated = signupSchema.parse(rawData);

        // Get Supabase client
        const supabase = await createClient();

        // Attempt sign up
        const { data, error } = await supabase.auth.signUp({
            email: validated.email,
            password: validated.password,
            options: {
                emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
            },
        });

        if (error) {
            console.error("Signup error:", error);
            return {
                success: false,
                error: error.message || "Failed to sign up",
            };
        }

        if (!data.user) {
            return {
                success: false,
                error: "Signup failed - no user returned",
            };
        }

        // Check if email confirmation is required
        if (data.user.identities && data.user.identities.length === 0) {
            return {
                success: false,
                error: "This email is already registered. Please login instead.",
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
