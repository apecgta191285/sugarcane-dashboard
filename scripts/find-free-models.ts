/**
 * OpenRouter Free Vision Model Discovery Script
 *
 * Queries OpenRouter API to find currently active FREE models
 * with likely VISION capabilities.
 *
 * Usage: npx tsx scripts/find-free-models.ts
 */

import * as dotenv from "dotenv";

// Load environment variables (optional for model list but good practice)
dotenv.config({ path: ".env.local" });

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

// Keywords that suggest vision capabilities
const VISION_KEYWORDS = ["vision", "gemini", "claude", "vl", "omni", "lens", "pixtral", "lava", "bakllava", "free"];

interface OpenRouterModel {
    id: string;
    name: string;
    pricing: {
        prompt: string;
        completion: string;
    };
    context_length: number;
    architecture?: {
        modality?: string;
    };
}

async function main() {
    console.log("=".repeat(80));
    console.log("🔍 OPENROUTER FREE VISION MODEL DISCOVERY");
    console.log("=".repeat(80));
    console.log();

    try {
        console.log(`📡 Fetching model list from ${OPENROUTER_MODELS_URL}...`);

        const response = await fetch(OPENROUTER_MODELS_URL, {
            headers: {
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Sugarcane Dashboard Discovery",
            }
        });

        if (!response.ok) {
            throw new Error(`API Request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as { data: OpenRouterModel[] };
        const allModels = data.data;

        console.log(`   Total models found: ${allModels.length}`);
        console.log("   Filtering for FREE + VISION capabilities...");
        console.log();

        // Filter Logic
        const freeVisionModels = allModels.filter(model => {
            // 1. Must be strictly free
            const isFree = model.pricing.prompt === "0" && model.pricing.completion === "0";
            if (!isFree) return false;

            // 2. Vision Check
            const idLower = model.id.toLowerCase();
            const nameLower = model.name.toLowerCase();

            // Check for explicit modality if available
            if (model.architecture?.modality?.includes("image")) return true;

            // Keyword check - filtering for known vision families or explicit "vision" keyword
            // We refine the keywords to avoid false positives (e.g. "free" matches too many text models)
            // But user asked for likely vision.

            const effectiveKeywords = ["vision", "gemini", "claude", "vl", "pixtral", "lava", "bakllava", "r1"];
            // "free" is not a vision keyword mostly. "gemini" 2.0/1.5 is usually vision capable.

            const hasVisionKeyword = effectiveKeywords.some(keyword =>
                idLower.includes(keyword) || nameLower.includes(keyword)
            );

            return hasVisionKeyword;
        });

        // Sort: Gemini first, then others
        freeVisionModels.sort((a, b) => {
            const aGemini = a.id.includes("gemini");
            const bGemini = b.id.includes("gemini");
            if (aGemini && !bGemini) return -1;
            if (!aGemini && bGemini) return 1;

            const aLlama = a.id.includes("llama");
            const bLlama = b.id.includes("llama");
            if (aLlama && !bLlama) return -1;
            if (!aLlama && bLlama) return 1;

            return a.id.localeCompare(b.id);
        });

        // output
        if (freeVisionModels.length === 0) {
            console.warn("⚠️ No models matched criteria.");
            return;
        }

        console.log(`✅ FOUND ${freeVisionModels.length} POTENTIAL VISION MODELS:`);
        console.log("-".repeat(90));
        console.log(`${"MODEL ID".padEnd(55)} | ${"CONTEXT".padEnd(10)} | ${"PRICING"}`);
        console.log("-".repeat(90));

        freeVisionModels.forEach(m => {
            console.log(
                `${m.id.padEnd(55)} | ${m.context_length.toString().padEnd(10)} | Free`
            );
        });
        console.log("-".repeat(90));
        console.log();
        console.log("💡 TIP: Copy an ID above to src/shared/lib/ai/client.ts");

    } catch (error) {
        console.error("❌ Error discovering models:", error);
    }
}

main();
