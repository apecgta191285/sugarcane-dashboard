"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Structured Diagnostic Result
 */
export interface StorageDiagnosticResult {
    success: boolean;
    timestamp: string;
    checks: {
        envVarPresent: boolean;
        userClientSeenBuckets: string[] | null;  // null if error
        adminClientSeenBuckets: string[] | null; // null if error
        userError?: string;
        adminError?: string;
    };
    conclusion:
    | "RLS_BLOCKING_USER"  // Admin sees bucket, User doesn't (expected)
    | "BUCKET_MISSING"     // Admin doesn't see bucket (infra issue)
    | "CONFIG_ERROR"       // Missing env vars or connection issues
    | "ALL_OK";            // Both see the bucket
}

const BUCKET_NAME = "receipts";

/**
 * Diagnose Storage Connectivity & Permissions
 * 
 * Scientific approach:
 * - Control Group: Admin Client (SERVICE_ROLE_KEY)
 * - Test Group: User Client (ANON_KEY)
 * 
 * @throws Error if SUPABASE_SERVICE_ROLE_KEY is missing
 */
export async function diagnoseStorage(): Promise<StorageDiagnosticResult> {
    const timestamp = new Date().toISOString();

    // ===========================================
    // [1] CRITICAL: Environment Variable Check
    // ===========================================
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const envVarPresent = !!(supabaseUrl && anonKey && serviceRoleKey);

    // CRITICAL: Throw immediately if service role key is missing
    if (!serviceRoleKey) {
        console.error("❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is not defined!");
        return {
            success: false,
            timestamp,
            checks: {
                envVarPresent: false,
                userClientSeenBuckets: null,
                adminClientSeenBuckets: null,
                userError: "Cannot diagnose - missing service role key",
                adminError: "SUPABASE_SERVICE_ROLE_KEY is not defined in .env.local",
            },
            conclusion: "CONFIG_ERROR",
        };
    }

    if (!supabaseUrl || !anonKey) {
        console.error("❌ CRITICAL: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
        return {
            success: false,
            timestamp,
            checks: {
                envVarPresent: false,
                userClientSeenBuckets: null,
                adminClientSeenBuckets: null,
                userError: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
                adminError: "Cannot create client without URL",
            },
            conclusion: "CONFIG_ERROR",
        };
    }

    // ===========================================
    // [2] Dual-Client Instantiation
    // ===========================================
    const userClient = createSupabaseClient(supabaseUrl, anonKey);
    const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey);

    // ===========================================
    // [3] Parallel Execution
    // ===========================================
    const [userResult, adminResult] = await Promise.all([
        userClient.storage.listBuckets(),
        adminClient.storage.listBuckets(),
    ]);

    // Process User Client Result
    let userClientSeenBuckets: string[] | null = null;
    let userError: string | undefined;

    if (userResult.error) {
        userError = userResult.error.message;
        console.log(`[USER CLIENT] Error: ${userError}`);
    } else {
        userClientSeenBuckets = userResult.data?.map((b) => b.name) ?? [];
        console.log(`[USER CLIENT] Buckets: [${userClientSeenBuckets.join(", ") || "empty"}]`);
    }

    // Process Admin Client Result
    let adminClientSeenBuckets: string[] | null = null;
    let adminError: string | undefined;

    if (adminResult.error) {
        adminError = adminResult.error.message;
        console.log(`[ADMIN CLIENT] Error: ${adminError}`);
    } else {
        adminClientSeenBuckets = adminResult.data?.map((b) => b.name) ?? [];
        console.log(`[ADMIN CLIENT] Buckets: [${adminClientSeenBuckets.join(", ") || "empty"}]`);
    }

    // ===========================================
    // [4] Determine Conclusion
    // ===========================================
    const adminSeesBucket = adminClientSeenBuckets?.includes(BUCKET_NAME) ?? false;
    const userSeesBucket = userClientSeenBuckets?.includes(BUCKET_NAME) ?? false;

    let conclusion: StorageDiagnosticResult["conclusion"];

    if (adminError || userError) {
        conclusion = "CONFIG_ERROR";
        console.log(`[CONCLUSION] CONFIG_ERROR - Client errors occurred`);
    } else if (adminSeesBucket && userSeesBucket) {
        conclusion = "ALL_OK";
        console.log(`[CONCLUSION] ALL_OK - Both clients see '${BUCKET_NAME}' bucket`);
    } else if (adminSeesBucket && !userSeesBucket) {
        conclusion = "RLS_BLOCKING_USER";
        console.log(`[CONCLUSION] RLS_BLOCKING_USER - Admin sees bucket, User doesn't (expected behavior)`);
    } else {
        conclusion = "BUCKET_MISSING";
        console.log(`[CONCLUSION] BUCKET_MISSING - '${BUCKET_NAME}' bucket does not exist`);
    }

    // ===========================================
    // [5] Return Structured Result
    // ===========================================
    return {
        success: conclusion === "ALL_OK" || conclusion === "RLS_BLOCKING_USER",
        timestamp,
        checks: {
            envVarPresent,
            userClientSeenBuckets,
            adminClientSeenBuckets,
            ...(userError && { userError }),
            ...(adminError && { adminError }),
        },
        conclusion,
    };
}
