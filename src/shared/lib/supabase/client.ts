"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/shared/types/database.types";

/**
 * Supabase Browser Client
 * 
 * Use this client in Client Components.
 * Creates a new client for each request to ensure proper session handling.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
