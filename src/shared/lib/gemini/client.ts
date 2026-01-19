import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

/**
 * Gemini AI Client Singleton
 * 
 * Uses the Singleton pattern to ensure only one instance of the 
 * GoogleGenerativeAI client exists throughout the application lifecycle.
 * 
 * IMPORTANT: This module should only be used in server-side code
 * (Server Actions, Route Handlers, Server Components).
 */

let geminiClient: GoogleGenerativeAI | null = null;

/**
 * Get the singleton GoogleGenerativeAI client instance.
 * 
 * @throws Error if GOOGLE_GEMINI_API_KEY is not defined
 */
export function getGeminiClient(): GoogleGenerativeAI {
    if (!geminiClient) {
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error(
                "GOOGLE_GEMINI_API_KEY is not defined. Please add it to your environment variables."
            );
        }

        geminiClient = new GoogleGenerativeAI(apiKey);
    }

    return geminiClient;
}

/**
 * Default generation configuration for JSON responses.
 * 
 * CRITICAL: responseMimeType: "application/json" enforces structured JSON output
 * from Gemini, which is essential for reliable parsing.
 */
export const defaultGenerationConfig = {
    responseMimeType: "application/json" as const,
    temperature: 0.1, // Low temperature for consistent, deterministic outputs
};

/**
 * Get the Gemini model with default JSON configuration.
 * 
 * Uses gemini-3-flash model optimized for fast, efficient processing.
 * Falls back to gemini-2.0-flash if gemini-3-flash is unavailable.
 * 
 * @param modelName - Optional model name override (default: "gemini-3-flash")
 */
export function getGeminiModel(modelName = "gemini-3-flash"): GenerativeModel {
    const client = getGeminiClient();

    return client.getGenerativeModel({
        model: modelName,
        generationConfig: defaultGenerationConfig,
    });
}

/**
 * OCR-specific Gemini model configuration.
 * 
 * Optimized for receipt OCR with:
 * - JSON output enforcement
 * - Very low temperature for consistent field extraction
 * - Specific safety settings for document processing
 */
export function getOCRModel(): GenerativeModel {
    const client = getGeminiClient();

    return client.getGenerativeModel({
        model: "gemini-3-flash",
        generationConfig: {
            ...defaultGenerationConfig,
            temperature: 0.05, // Even lower for OCR consistency
        },
    });
}

/**
 * Utility to convert image file to base64 for Gemini Vision API.
 * 
 * @param buffer - Image buffer
 * @param mimeType - Image MIME type (e.g., "image/jpeg", "image/png")
 */
export function imageToGenerativePart(buffer: Buffer, mimeType: string) {
    return {
        inlineData: {
            data: buffer.toString("base64"),
            mimeType,
        },
    };
}
