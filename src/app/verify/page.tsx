"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle, XCircle, Loader2, Database, HardDrive, Sparkles, RefreshCw } from "lucide-react";
import { runHealthCheck, type HealthCheckResult, type ServiceHealth } from "@/features/system/actions/health-check";

/**
 * Status Card Component
 */
function StatusCard({ service, icon: Icon }: { service: ServiceHealth; icon: React.ElementType }) {
    const isOk = service.status === "ok";

    return (
        <div
            className={`rounded-lg border-2 p-6 transition-all ${isOk
                    ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                    : "border-red-500 bg-red-50 dark:bg-red-950/20"
                }`}
        >
            <div className="flex items-center gap-3 mb-4">
                <div
                    className={`p-2 rounded-full ${isOk ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"
                        }`}
                >
                    <Icon className={`w-6 h-6 ${isOk ? "text-green-600" : "text-red-600"}`} />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-lg">{service.name}</h3>
                    {service.latencyMs !== undefined && (
                        <span className="text-sm text-gray-500">{service.latencyMs}ms</span>
                    )}
                </div>
                {isOk ? (
                    <CheckCircle className="w-8 h-8 text-green-500" />
                ) : (
                    <XCircle className="w-8 h-8 text-red-500" />
                )}
            </div>
            <p
                className={`text-sm ${isOk ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
                    }`}
            >
                {service.message}
            </p>
        </div>
    );
}

/**
 * Infrastructure Health Check Page
 */
export default function VerifyPage() {
    const [result, setResult] = useState<HealthCheckResult | null>(null);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const runCheck = () => {
        setError(null);
        startTransition(async () => {
            try {
                const healthResult = await runHealthCheck();
                setResult(healthResult);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error occurred");
            }
        });
    };

    // Run check on mount
    useEffect(() => {
        runCheck();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        🏥 Infrastructure Health Check
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Verifying Database, Storage, and AI connectivity
                    </p>
                </div>

                {/* Refresh Button */}
                <div className="flex justify-center mb-8">
                    <button
                        onClick={runCheck}
                        disabled={isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4" />
                        )}
                        {isPending ? "Checking..." : "Run Health Check"}
                    </button>
                </div>

                {/* Error State */}
                {error && (
                    <div className="mb-8 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                {/* Loading State */}
                {isPending && !result && (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
                        <p className="text-gray-600 dark:text-gray-400">Running health checks...</p>
                    </div>
                )}

                {/* Results */}
                {result && (
                    <>
                        {/* Overall Status */}
                        <div
                            className={`mb-8 p-4 rounded-lg text-center font-semibold ${result.allHealthy
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                }`}
                        >
                            {result.allHealthy
                                ? "✅ All Systems Operational"
                                : "❌ Some Services Have Issues"}
                        </div>

                        {/* Service Cards */}
                        <div className="grid gap-4">
                            <StatusCard service={result.services.database} icon={Database} />
                            <StatusCard service={result.services.storage} icon={HardDrive} />
                            <StatusCard service={result.services.gemini} icon={Sparkles} />
                        </div>

                        {/* Timestamp */}
                        <p className="text-center text-sm text-gray-500 mt-8">
                            Last checked: {new Date(result.timestamp).toLocaleString("th-TH")}
                        </p>
                    </>
                )}

                {/* Instructions */}
                <div className="mt-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white">
                        🔧 Troubleshooting
                    </h2>
                    <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                        <li>
                            <strong>Database Error:</strong> Ensure <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">supabase/schema.sql</code> has been executed in Supabase SQL Editor.
                        </li>
                        <li>
                            <strong>Storage Bucket Missing:</strong> Create a bucket named <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">receipts</code> in Supabase Storage.
                        </li>
                        <li>
                            <strong>Gemini Error:</strong> Verify <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">GOOGLE_GEMINI_API_KEY</code> is set in <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env.local</code>.
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
