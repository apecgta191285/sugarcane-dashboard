"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Loader2, Shield, User, CheckCircle, XCircle, AlertTriangle, Server } from "lucide-react";
import { diagnoseStorage, type StorageDiagnosticResult } from "@/features/system/actions/diagnose-storage";

/**
 * Conclusion Badge Component
 */
function ConclusionBadge({ conclusion }: { conclusion: StorageDiagnosticResult["conclusion"] }) {
    const config = {
        ALL_OK: { bg: "bg-green-600", text: "All Systems OK", icon: CheckCircle },
        RLS_BLOCKING_USER: { bg: "bg-yellow-600", text: "RLS Blocking User (Expected)", icon: AlertTriangle },
        BUCKET_MISSING: { bg: "bg-red-600", text: "Bucket Missing", icon: XCircle },
        CONFIG_ERROR: { bg: "bg-red-600", text: "Configuration Error", icon: XCircle },
    };

    const { bg, text, icon: Icon } = config[conclusion];

    return (
        <div className={`${bg} px-4 py-2 rounded-lg flex items-center gap-2 text-white font-semibold`}>
            <Icon className="w-5 h-5" />
            {text}
        </div>
    );
}

/**
 * Bucket List Display
 */
function BucketList({ buckets, error, label }: {
    buckets: string[] | null;
    error?: string;
    label: string;
}) {
    return (
        <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-sm text-gray-400 mb-2">{label}</div>
            {error ? (
                <div className="text-red-400 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {error}
                </div>
            ) : buckets === null ? (
                <div className="text-gray-500">No data</div>
            ) : buckets.length === 0 ? (
                <div className="text-yellow-400">[ empty - no buckets visible ]</div>
            ) : (
                <div className="font-mono text-green-400">
                    [{buckets.map((b, i) => (
                        <span key={b}>
                            {i > 0 && ", "}
                            <span className={b === "receipts" ? "text-green-300 font-bold" : ""}>
                                {b === "receipts" ? `✅ ${b}` : b}
                            </span>
                        </span>
                    ))}]
                </div>
            )}
        </div>
    );
}

/**
 * Storage Diagnostic Page
 */
export default function DiagnosticPage() {
    const [result, setResult] = useState<StorageDiagnosticResult | null>(null);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const runDiagnostic = () => {
        setError(null);
        startTransition(async () => {
            try {
                const diagnosticResult = await diagnoseStorage();
                setResult(diagnosticResult);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error occurred");
            }
        });
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">🔬 Storage Root Cause Analysis</h1>
                    <p className="text-gray-400">
                        Scientific comparison: User Client vs Admin Client
                    </p>
                </div>

                {/* Run Button */}
                <div className="flex justify-center mb-8">
                    <button
                        onClick={runDiagnostic}
                        disabled={isPending}
                        className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                    >
                        {isPending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <RefreshCw className="w-5 h-5" />
                        )}
                        {isPending ? "Running Diagnostic..." : "Run Diagnostic"}
                    </button>
                </div>

                {/* Error State */}
                {error && (
                    <div className="mb-8 p-4 bg-red-900/50 border border-red-500 text-red-300 rounded-lg">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div className="space-y-6">
                        {/* Header Row */}
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <ConclusionBadge conclusion={result.conclusion} />
                            <div className="text-sm text-gray-500">
                                {new Date(result.timestamp).toLocaleString("th-TH")}
                            </div>
                        </div>

                        {/* Environment Check */}
                        <div className={`p-4 rounded-lg flex items-center gap-3 ${result.checks.envVarPresent
                                ? "bg-green-900/30 border border-green-600"
                                : "bg-red-900/30 border border-red-600"
                            }`}>
                            <Server className={`w-5 h-5 ${result.checks.envVarPresent ? "text-green-400" : "text-red-400"
                                }`} />
                            <span>Environment Variables:</span>
                            <span className={`font-mono ${result.checks.envVarPresent ? "text-green-400" : "text-red-400"
                                }`}>
                                {result.checks.envVarPresent ? "All Present ✅" : "Missing ❌"}
                            </span>
                        </div>

                        {/* Client Comparison */}
                        <div className="grid md:grid-cols-2 gap-4">
                            {/* User Client */}
                            <div className="p-6 rounded-lg bg-gray-800/50 border border-gray-700">
                                <div className="flex items-center gap-3 mb-4">
                                    <User className="w-6 h-6 text-blue-400" />
                                    <div>
                                        <h3 className="font-semibold">User Client</h3>
                                        <div className="text-xs text-gray-500">ANON_KEY</div>
                                    </div>
                                </div>
                                <BucketList
                                    buckets={result.checks.userClientSeenBuckets}
                                    error={result.checks.userError}
                                    label="Visible Buckets:"
                                />
                            </div>

                            {/* Admin Client */}
                            <div className="p-6 rounded-lg bg-gray-800/50 border border-gray-700">
                                <div className="flex items-center gap-3 mb-4">
                                    <Shield className="w-6 h-6 text-purple-400" />
                                    <div>
                                        <h3 className="font-semibold">Admin Client</h3>
                                        <div className="text-xs text-gray-500">SERVICE_ROLE_KEY</div>
                                    </div>
                                </div>
                                <BucketList
                                    buckets={result.checks.adminClientSeenBuckets}
                                    error={result.checks.adminError}
                                    label="Visible Buckets:"
                                />
                            </div>
                        </div>

                        {/* Interpretation */}
                        <div className="p-6 rounded-lg bg-gray-800 border border-gray-600">
                            <h3 className="font-semibold mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                                Interpretation
                            </h3>
                            <div className="space-y-3 text-sm">
                                {result.conclusion === "RLS_BLOCKING_USER" && (
                                    <>
                                        <p className="text-yellow-300">
                                            ✅ <strong>This is expected behavior.</strong> RLS is working correctly.
                                        </p>
                                        <p className="text-gray-400">
                                            The <code className="bg-gray-700 px-1 rounded">receipts</code> bucket exists and is properly secured.
                                            Anonymous users cannot list all buckets (security feature).
                                        </p>
                                        <p className="text-green-300">
                                            <strong>Fix:</strong> Update <code className="bg-gray-700 px-1 rounded">health-check.ts</code> to use Admin Client for the storage check.
                                        </p>
                                    </>
                                )}
                                {result.conclusion === "BUCKET_MISSING" && (
                                    <>
                                        <p className="text-red-300">
                                            ❌ <strong>The bucket does not exist.</strong>
                                        </p>
                                        <p className="text-gray-400">
                                            Neither the Admin Client nor the User Client can see the <code className="bg-gray-700 px-1 rounded">receipts</code> bucket.
                                        </p>
                                        <p className="text-yellow-300">
                                            <strong>Fix:</strong> Go to Supabase Dashboard → Storage → Create bucket named <code className="bg-gray-700 px-1 rounded">receipts</code>
                                        </p>
                                    </>
                                )}
                                {result.conclusion === "ALL_OK" && (
                                    <p className="text-green-300">
                                        ✅ <strong>Everything is working correctly.</strong> Both clients can see the bucket.
                                    </p>
                                )}
                                {result.conclusion === "CONFIG_ERROR" && (
                                    <>
                                        <p className="text-red-300">
                                            ❌ <strong>Configuration error.</strong>
                                        </p>
                                        <p className="text-gray-400">
                                            Check your <code className="bg-gray-700 px-1 rounded">.env.local</code> file for missing or incorrect values.
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Raw JSON */}
                        <details className="bg-gray-800 rounded-lg">
                            <summary className="p-4 cursor-pointer text-gray-400 hover:text-white">
                                View Raw JSON Response
                            </summary>
                            <pre className="p-4 text-xs overflow-auto text-green-400 border-t border-gray-700">
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        </details>
                    </div>
                )}

                {/* Back Link */}
                <div className="text-center mt-8">
                    <a href="/verify" className="text-blue-400 hover:text-blue-300 underline">
                        ← Back to Health Check
                    </a>
                </div>
            </div>
        </div>
    );
}
