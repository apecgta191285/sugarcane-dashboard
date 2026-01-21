/**
 * OpenRouter AI Client
 *
 * Uses OpenAI SDK configured for OpenRouter's API endpoint.
 * Provides access to free-tier vision models with multi-model fallback.
 *
 * IMPORTANT: This module should only be used in server-side code
 * (Server Actions, Route Handlers, Server Components).
 */

import OpenAI from "openai";

// ============================================
// Configuration
// ============================================

/**
 * Vision-capable free models (ordered by preference)
 * Updated based on OpenRouter discovery script results
 */
export const VISION_MODELS = [
    "google/gemini-2.0-flash-exp:free",      // Primary - Best quality
    "qwen/qwen-2.5-vl-7b-instruct:free",     // Strong fallback - Good vision
    "nvidia/nemotron-nano-12b-v2-vl:free",   // Backup - Reliable  
] as const;

/**
 * OpenRouter client singleton
 */
let openRouterClient: OpenAI | null = null;

// ============================================
// Client Initialization
// ============================================

/**
 * Get the OpenRouter client instance.
 * Returns null if API key is not configured (graceful degradation).
 */
export function getAIClient(): OpenAI | null {
    if (openRouterClient) return openRouterClient;

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        console.warn("⚠️ [AI Client] OPENROUTER_API_KEY missing. OCR features will be disabled.");
        return null;
    }

    openRouterClient = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: apiKey,
        timeout: 30000, // 30s timeout for vision models
        defaultHeaders: {
            "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
            "X-Title": "Sugarcane Dashboard",
        },
    });

    console.log("🚀 AI Client initialized (OpenRouter)");
    return openRouterClient;
}

// ============================================
// JSON Sanitization Utilities
// ============================================

/**
 * Clean and extract valid JSON from AI response.
 * 
 * Handles common AI output issues:
 * - Markdown code blocks (```json ... ```)
 * - Conversational text before/after JSON
 * - Extra whitespace and newlines
 * 
 * @param rawText - Raw AI response text
 * @returns Cleaned JSON string or null if no valid JSON found
 */
export function cleanJSON(rawText: string): string | null {
    if (!rawText) return null;

    // Step 1: Remove markdown code blocks
    let cleaned = rawText
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

    // Step 2: Find the first { and last } to extract JSON object
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
        console.warn("⚠️ [cleanJSON] No valid JSON object braces found");
        return null;
    }

    // Step 3: Extract only the JSON substring
    const jsonString = cleaned.substring(firstBrace, lastBrace + 1);

    return jsonString;
}

// ============================================
// OCR Types
// ============================================

/**
 * OCR extraction result interface
 */
export interface OCRExtractedData {
    supplier_name?: string | null;
    date?: string | null;
    total_amount?: number | null;
    cane_type?: string | null;
    weight_net?: number | null;
    price_per_ton?: number | null;
}

// ============================================
// Main OCR Function
// ============================================

/**
 * Analyze a receipt image using OpenRouter's vision models.
 * Implements multi-model fallback with robust JSON extraction.
 *
 * @param base64Image - Base64 encoded image data
 * @param mimeType - Image MIME type (e.g., "image/jpeg")
 * @returns Object with data (extracted data) or error message
 */
export async function analyzeReceipt(
    base64Image: string,
    mimeType: string
): Promise<{ data: OCRExtractedData | null; error: string | null }> {
    const client = getAIClient();
    if (!client) {
        return { data: null, error: "AI client not configured (missing OPENROUTER_API_KEY)" };
    }

    const prompt = `Analyze this sugarcane receipt image. Extract data into this exact JSON schema:
{
    "supplier_name": string | null,
    "date": string | null (ISO format YYYY-MM-DD),
    "total_amount": number | null,
    "cane_type": string | null,
    "weight_net": number | null (in kg),
    "price_per_ton": number | null
}

IMPORTANT:
- Convert Thai dates to ISO format (YYYY-MM-DD)
- Return ONLY the JSON object, no explanation or markdown
- Use null for any field you cannot determine`;

    const errors: string[] = [];

    // Try each vision model until one succeeds
    for (const model of VISION_MODELS) {
        try {
            console.log(`🤖 Trying model: ${model}...`);

            const response = await client.chat.completions.create({
                model: model,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${base64Image}`,
                                },
                            },
                        ],
                    },
                ],
                max_tokens: 1024,
                temperature: 0.1,
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                console.warn(`⚠️ Empty response from ${model}`);
                errors.push(`${model}: Empty response`);
                continue;
            }

            // Sanitize using robust JSON extraction
            const jsonString = cleanJSON(content);
            if (!jsonString) {
                console.warn(`⚠️ Could not extract JSON from ${model} response`);
                errors.push(`${model}: Invalid JSON structure`);
                continue;
            }

            // Parse the cleaned JSON
            const parsed = JSON.parse(jsonString) as OCRExtractedData;
            console.log(`✅ OCR Success with ${model}:`, parsed);
            return { data: parsed, error: null };

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.warn(`⚠️ Model ${model} failed:`, errorMsg);
            errors.push(`${model}: ${errorMsg.substring(0, 50)}`);
            // Continue to next model
        }
    }

    // All models failed
    const errorSummary = errors.join(" | ");
    return {
        data: null,
        error: `All AI models failed for OCR extraction. Details: ${errorSummary}`
    };
}

// ============================================
// Health Check
// ============================================

/**
 * Simple health check for the AI service
 */
export async function checkAIHealth(): Promise<{
    status: "ok" | "error";
    message: string;
    latencyMs?: number;
}> {
    const startTime = Date.now();
    const client = getAIClient();

    if (!client) {
        return {
            status: "error",
            message: "OPENROUTER_API_KEY not configured",
            latencyMs: Date.now() - startTime,
        };
    }

    try {
        // Simple ping using text generation
        const response = await client.chat.completions.create({
            model: VISION_MODELS[0],
            messages: [{ role: "user", content: "Say OK" }],
            max_tokens: 10,
        });

        return {
            status: "ok",
            message: `OpenRouter connected (Model: ${VISION_MODELS[0]})`,
            latencyMs: Date.now() - startTime,
        };
    } catch (error) {
        return {
            status: "error",
            message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
            latencyMs: Date.now() - startTime,
        };
    }
}
