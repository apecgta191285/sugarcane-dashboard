"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/shared/lib/supabase/server";
import { getAIClient } from "@/shared/lib/ai/client";

/**
 * Health Check Result for a single service
 */
export interface ServiceHealth {
    name: string;
    status: "ok" | "error";
    message: string;
    latencyMs?: number;
}

/**
 * Complete health check response
 */
export interface HealthCheckResult {
    timestamp: string;
    services: {
        database: ServiceHealth;
        storage: ServiceHealth;
        ai: ServiceHealth;
    };
    allHealthy: boolean;
}

/**
 * Check Database connectivity by querying the receipts table
 */
async function checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
        const supabase = await createClient();

        const { count, error } = await supabase
            .from("receipts")
            .select("*", { count: "exact", head: true });

        const latencyMs = Date.now() - startTime;

        if (error) {
            return {
                name: "Database",
                status: "error",
                message: `Query failed: ${error.message}`,
                latencyMs,
            };
        }

        return {
            name: "Database",
            status: "ok",
            message: `Connected. Receipts count: ${count ?? 0}`,
            latencyMs,
        };
    } catch (err) {
        return {
            name: "Database",
            status: "error",
            message: `Connection error: ${err instanceof Error ? err.message : String(err)}`,
            latencyMs: Date.now() - startTime,
        };
    }
}

/**
 * Check Storage by listing buckets and verifying 'receipts' bucket exists
 * 
 * NOTE: Uses Admin Client (SERVICE_ROLE_KEY) because RLS blocks anonymous
 * users from listing buckets. This is a privileged health check.
 */
async function checkStorage(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
        // Validate required environment variables
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!serviceRoleKey) {
            return {
                name: "Storage",
                status: "error",
                message: "Server misconfiguration: Missing Service Key",
                latencyMs: Date.now() - startTime,
            };
        }

        if (!supabaseUrl) {
            return {
                name: "Storage",
                status: "error",
                message: "Server misconfiguration: Missing Supabase URL",
                latencyMs: Date.now() - startTime,
            };
        }

        // Use Admin Client to bypass RLS for bucket listing
        const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey);

        const { data: buckets, error } = await adminClient.storage.listBuckets();

        const latencyMs = Date.now() - startTime;

        if (error) {
            return {
                name: "Storage",
                status: "error",
                message: `Failed to list buckets: ${error.message}`,
                latencyMs,
            };
        }

        const receiptsBucket = buckets?.find((b) => b.name === "receipts");

        if (!receiptsBucket) {
            return {
                name: "Storage",
                status: "error",
                message: `Bucket 'receipts' not found. Available: ${buckets?.map((b) => b.name).join(", ") || "none"}`,
                latencyMs,
            };
        }

        return {
            name: "Storage",
            status: "ok",
            message: `Bucket 'receipts' exists (ID: ${receiptsBucket.id})`,
            latencyMs,
        };
    } catch (err) {
        return {
            name: "Storage",
            status: "error",
            message: `Storage error: ${err instanceof Error ? err.message : String(err)}`,
            latencyMs: Date.now() - startTime,
        };
    }
}

/**
 * Check OpenRouter AI client instantiation
 */
async function checkAI(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
        // Attempt to get the client - this validates API key
        const client = getAIClient();

        const latencyMs = Date.now() - startTime;

        // Verify client is instantiated properly
        if (!client) {
            return {
                name: "OpenRouter AI",
                status: "error",
                message: "Failed to instantiate OpenRouter client (API key missing)",
                latencyMs,
            };
        }

        return {
            name: "OpenRouter AI",
            status: "ok",
            message: `Client instantiated (using Gemini 2.0 Flash via OpenRouter)`,
            latencyMs,
        };
    } catch (err) {
        return {
            name: "OpenRouter AI",
            status: "error",
            message: `AI error: ${err instanceof Error ? err.message : String(err)}`,
            latencyMs: Date.now() - startTime,
        };
    }
}

/**
 * Run all health checks and return aggregated result
 */
export async function runHealthCheck(): Promise<HealthCheckResult> {
    // Run all checks in parallel for faster response
    const [database, storage, ai] = await Promise.all([
        checkDatabase(),
        checkStorage(),
        checkAI(),
    ]);

    const allHealthy =
        database.status === "ok" &&
        storage.status === "ok" &&
        ai.status === "ok";

    return {
        timestamp: new Date().toISOString(),
        services: {
            database,
            storage,
            ai,
        },
        allHealthy,
    };
}
