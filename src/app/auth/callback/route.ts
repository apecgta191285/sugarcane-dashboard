import { createClient } from "@/shared/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Auth Callback Route Handler
 * 
 * Handles the PKCE exchange flow from Supabase Auth.
 * Exchanges the temporary code for a secure session cookie.
 */
export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const next = requestUrl.searchParams.get("next") ?? "/dashboard";
    const origin = requestUrl.origin;

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // Successful exchange - redirect to intended destination
            return NextResponse.redirect(`${origin}${next}`);
        }

        // Exchange failed - redirect to login with error
        console.error("Auth code exchange error:", error.message);
        return NextResponse.redirect(
            `${origin}/login?error=auth_code_error`
        );
    }

    // No code provided - redirect to login with error
    return NextResponse.redirect(`${origin}/login?error=auth_code_error`);
}
