/**
 * OpenRouter API Verification Script
 * 
 * Standalone probe to verify OpenRouter connection, API key validity,
 * and free-tier model availability.
 * 
 * Usage: npx tsx scripts/verify-openrouter.ts
 */

import * as dotenv from "dotenv";
import OpenAI from "openai";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

// ============================================
// Configuration
// ============================================
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const TIMEOUT_MS = 10000; // 10 seconds

// Free-tier models to test (in order of preference)
const MODELS_TO_TEST = [
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-exp-1206:free",
    "meta-llama/llama-3.2-11b-vision-instruct:free",
] as const;

// ============================================
// Main Verification Logic
// ============================================
async function main() {
    console.log("=".repeat(60));
    console.log("🔬 OPENROUTER API VERIFICATION");
    console.log("=".repeat(60));
    console.log();

    // Step 1: Check API Key
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        console.error("❌ FAIL | Error: OPENROUTER_API_KEY is not set in .env.local");
        console.error();
        console.error("   To fix: Add the following to your .env.local file:");
        console.error("   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxx");
        console.error();
        console.error("   Get your free API key at: https://openrouter.ai/keys");
        process.exit(1);
    }

    console.log(`📍 API Key: ${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 4)}`);
    console.log(`📍 Base URL: ${OPENROUTER_BASE_URL}`);
    console.log(`📍 Timeout: ${TIMEOUT_MS}ms`);
    console.log();

    // Step 2: Initialize OpenAI Client
    const client = new OpenAI({
        baseURL: OPENROUTER_BASE_URL,
        apiKey: apiKey,
        timeout: TIMEOUT_MS,
        defaultHeaders: {
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Sugarcane Dashboard Verification",
        },
    });

    console.log("🔄 Testing models...");
    console.log();

    // Step 3: Test each model
    let successModel: string | null = null;

    for (const model of MODELS_TO_TEST) {
        try {
            process.stdout.write(`   Testing ${model}... `);

            const startTime = Date.now();

            const response = await client.chat.completions.create({
                model: model,
                messages: [
                    {
                        role: "user",
                        content: "Say 'Hello from OpenRouter!' and nothing else."
                    }
                ],
                max_tokens: 50,
                temperature: 0.1,
            });

            const latencyMs = Date.now() - startTime;
            const content = response.choices[0]?.message?.content || "";
            const preview = content.substring(0, 50).replace(/\n/g, " ");

            console.log(`✅ PASS (${latencyMs}ms)`);
            console.log(`      └─ Response: "${preview}${content.length > 50 ? '...' : ''}"`);

            successModel = model;
            break; // Success - stop testing

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(`❌ FAIL`);
            console.log(`      └─ Error: ${errorMessage.substring(0, 80)}...`);
        }
    }

    console.log();
    console.log("=".repeat(60));

    // Step 4: Summary
    if (successModel) {
        console.log("📊 RESULT: ✅ VERIFICATION PASSED");
        console.log();
        console.log(`   Working Model: ${successModel}`);
        console.log();
        console.log("   Your OpenRouter configuration is ready for use!");
        console.log("   The application will use this model for OCR processing.");
    } else {
        console.log("📊 RESULT: ❌ VERIFICATION FAILED");
        console.log();
        console.log("   All models failed. Possible causes:");
        console.log("   1. Rate limit exceeded - wait a few minutes and try again");
        console.log("   2. API key is invalid or expired");
        console.log("   3. Network connectivity issues");
        console.log();
        console.log("   Check your API key status at: https://openrouter.ai/keys");
        process.exit(1);
    }

    console.log("=".repeat(60));
}

// Run with error handling
main().catch((error) => {
    console.error("❌ FAIL | Unexpected Error:", error.message);
    process.exit(1);
});
