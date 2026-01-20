/**
 * OpenRouter AI Client
 *
 * Uses OpenAI SDK configured for OpenRouter's API endpoint.
 * Provides access to free-tier Gemini models without Google billing.
 *
 * IMPORTANT: This module should only be used in server-side code
 * (Server Actions, Route Handlers, Server Components).
 */

import OpenAI from "openai";

/**
 * OpenRouter client singleton
 */
let openRouterClient: OpenAI | null = null;

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
        defaultHeaders: {
            "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
            "X-Title": "Sugarcane Dashboard",
        },
    });

    console.log("🚀 AI Client initialized (OpenRouter)");
    return openRouterClient;
}

/**
 * Free-tier models available on OpenRouter (ordered by preference)
 */
export const FREE_MODELS = [
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-exp-1206:free",
    "meta-llama/llama-3.2-11b-vision-instruct:free",
] as const;

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

/**
 * Analyze a receipt image using OpenRouter's vision models.
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

    const prompt = `Analyze this sugarcane receipt. Extract data into this JSON schema:
{
    "supplier_name": string | null,
    "date": string | null (ISO format YYYY-MM-DD),
    "total_amount": number | null,
    "cane_type": string | null,
    "weight_net": number | null (in kg),
    "price_per_ton": number | null
}
Convert Thai dates to ISO. Return ONLY valid JSON, no markdown.`;

    // Try each free model until one works
    for (const model of FREE_MODELS) {
        try {
            console.log(`🤖 Trying model: ${model}`);

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
                continue;
            }

            // Sanitize: Remove markdown code blocks
            const sanitized = content.replace(/```json|```/g, "").trim();

            const parsed = JSON.parse(sanitized) as OCRExtractedData;
            console.log(`✅ OCR Success with ${model}:`, parsed);
            return { data: parsed, error: null };
        } catch (error) {
            console.warn(`⚠️ Model ${model} failed:`, error);
            // Continue to next model
        }
    }

    return { data: null, error: "All AI models failed for OCR extraction" };
}

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
            model: FREE_MODELS[0],
            messages: [{ role: "user", content: "Say OK" }],
            max_tokens: 10,
        });

        return {
            status: "ok",
            message: `OpenRouter connected (Model: ${FREE_MODELS[0]})`,
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
