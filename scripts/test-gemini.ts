/**
 * OpenRouter API Model Availability Test
 * 
 * Diagnostic script to determine OpenRouter connection and model status.
 * 
 * Usage: npx tsx scripts/test-gemini.ts
 */

import * as dotenv from "dotenv";
import OpenAI from "openai";

// Load environment variables from .env.local (Next.js convention)
dotenv.config({ path: ".env.local" });

// Models to test (ordered by preference)
const MODELS_TO_TEST = [
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-pro-1.5-exp:free",
];

interface TestResult {
    model: string;
    status: "PASS" | "FAIL";
    latencyMs?: number;
    errorCode?: string;
    errorMessage?: string;
}

async function testModel(client: OpenAI, modelName: string): Promise<TestResult> {
    const startTime = Date.now();

    try {
        const result = await client.chat.completions.create({
            model: modelName,
            messages: [{ role: "user", content: "Say 'OK' and nothing else." }],
            max_tokens: 10,
        });

        const text = result.choices[0]?.message?.content;

        return {
            model: modelName,
            status: "PASS",
            latencyMs: Date.now() - startTime,
        };
    } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return {
            model: modelName,
            status: "FAIL",
            latencyMs: Date.now() - startTime,
            errorCode: err.status?.toString() || "UNKNOWN",
            errorMessage: err.message || String(error),
        };
    }
}

async function main() {
    console.log("=".repeat(60));
    console.log("🔬 OPENROUTER API MODEL AVAILABILITY TEST");
    console.log("=".repeat(60));
    console.log();

    // Check for API Key
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        console.error("❌ ERROR: No API Key found!");
        console.error("   Set OPENROUTER_API_KEY in .env.local");
        process.exit(1);
    }

    console.log(`📍 API Key: ${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 4)}`);
    console.log(`📍 Testing ${MODELS_TO_TEST.length} models...`);
    console.log();

    const client = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
        defaultHeaders: {
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Sugarcane Dashboard Test",
        },
    });

    const results: TestResult[] = [];

    for (const modelName of MODELS_TO_TEST) {
        process.stdout.write(`   Testing ${modelName}... `);
        const result = await testModel(client, modelName);
        results.push(result);

        if (result.status === "PASS") {
            console.log(`✅ PASS (${result.latencyMs}ms)`);
        } else {
            console.log(`❌ FAIL [${result.errorCode}]`);
            console.log(`      └─ ${result.errorMessage?.substring(0, 80)}...`);
        }
    }

    // Summary
    console.log();
    console.log("=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));

    const passed = results.filter(r => r.status === "PASS");
    const failed = results.filter(r => r.status === "FAIL");

    console.log(`   ✅ Passed: ${passed.length}`);
    console.log(`   ❌ Failed: ${failed.length}`);
    console.log();

    if (passed.length > 0) {
        console.log("🎯 RECOMMENDED MODEL:", passed[0].model);
        console.log();
        console.log("   Currently configured in src/shared/lib/ai/client.ts");
    } else {
        console.log("⚠️  NO WORKING MODELS FOUND!");
        console.log("   Please check your OpenRouter API Key at:");
        console.log("   https://openrouter.ai/keys");
    }

    console.log();
    console.log("=".repeat(60));
}

main().catch(console.error);
