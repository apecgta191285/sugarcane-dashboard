# SUGAR-OP Architecture Document
> Technical Architecture for Smart Sugarcane Dashboard

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Next.js 15 App Router                         │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │    │
│  │  │ Features │  │ Shared   │  │ Stores   │  │ Server Actions   │ │    │
│  │  │ (Pages)  │  │ (UI/Lib) │  │ (Zustand)│  │ (Mutations)      │ │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVICES                                 │
│  ┌────────────────────┐          ┌────────────────────────────────────┐ │
│  │   Supabase         │          │   Google Gemini 2.0 Flash          │ │
│  │   ├── Auth         │          │   └── Vision OCR Processing        │ │
│  │   ├── PostgreSQL   │          └────────────────────────────────────┘ │
│  │   └── Storage      │                                                  │
│  └────────────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Feature-Sliced Design Structure

```
src/
├── app/                          # Next.js 15 App Router
│   ├── (auth)/                   # Auth route group
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/              # Protected route group
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Dashboard home
│   │   ├── receipts/
│   │   │   ├── page.tsx          # Receipt list
│   │   │   ├── [id]/page.tsx     # Receipt detail
│   │   │   └── upload/page.tsx   # Upload new receipt
│   │   └── settings/
│   └── api/                      # API Routes (if needed)
│
├── features/                     # Feature-Sliced Design
│   ├── auth/
│   │   ├── actions/              # Server Actions
│   │   ├── components/           # Feature-specific UI
│   │   ├── hooks/                # Feature-specific hooks
│   │   └── types/                # Feature types
│   │
│   ├── receipts/
│   │   ├── actions/
│   │   │   ├── upload-receipt.ts
│   │   │   ├── process-ocr.ts
│   │   │   └── verify-receipt.ts
│   │   ├── components/
│   │   │   ├── receipt-upload-form.tsx
│   │   │   ├── ocr-result-viewer.tsx
│   │   │   └── receipt-table.tsx
│   │   ├── hooks/
│   │   │   └── use-receipts.ts
│   │   └── types/
│   │       └── receipt.types.ts
│   │
│   └── dashboard/
│       ├── components/
│       └── hooks/
│
├── shared/                       # Shared across features
│   ├── components/
│   │   └── ui/                   # Shadcn components
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts         # Browser client
│   │   │   └── server.ts         # Server client
│   │   ├── gemini/
│   │   │   └── client.ts         # Gemini singleton
│   │   └── utils.ts
│   ├── hooks/                    # Shared hooks
│   └── types/                    # Global types
│
└── stores/                       # Zustand stores
    └── ui-store.ts
```

---

## 3. AI Integration Pattern

### 3.1 Singleton GoogleGenerativeAI Client

```typescript
// src/shared/lib/gemini/client.ts

import { GoogleGenerativeAI } from "@google/generative-ai";

// Singleton pattern for Gemini client
let geminiClient: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not defined");
    }
    
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  
  return geminiClient;
}

export function getGeminiModel() {
  const client = getGeminiClient();
  return client.getGenerativeModel({ 
    model: "gemini-3-flash",
  });
}
```

### 3.2 Prompting Strategy with Strict JSON Output

> [!CRITICAL]
> **Always use `responseMimeType: "application/json"` to enforce structured output from Gemini.**

```typescript
// src/features/receipts/actions/process-ocr.ts

import { getGeminiModel } from "@/shared/lib/gemini/client";
import { receiptOcrSchema } from "../types/receipt.types";

export async function processReceiptOCR(imageBase64: string) {
  const model = getGeminiModel();
  
  const prompt = `
You are an OCR specialist for Thai sugarcane transaction receipts.
Extract the following fields from the receipt image:

- date: Transaction date in ISO 8601 format (YYYY-MM-DD)
- supplier_name: Name of the farmer/supplier
- weight_kg: Total weight in kilograms (number)
- price_per_kg: Price per kilogram in THB (number)
- total_amount: Total transaction amount in THB (number)
- receipt_number: Receipt/transaction ID if visible
- notes: Any additional relevant information

If a field is not clearly visible, use null.
`;

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",  // CRITICAL: Enforce JSON output
      temperature: 0.1,                       // Low temperature for consistency
    },
  });

  const responseText = result.response.text();
  const parsedData = JSON.parse(responseText);
  
  // MANDATORY: Validate with Zod
  return receiptOcrSchema.parse(parsedData);
}
```

### 3.3 Zod Schema for OCR Response Validation

```typescript
// src/features/receipts/types/receipt.types.ts

import { z } from "zod";

export const receiptOcrSchema = z.object({
  date: z.string().nullable(),
  supplier_name: z.string().nullable(),
  weight_kg: z.number().nullable(),
  price_per_kg: z.number().nullable(),
  total_amount: z.number().nullable(),
  receipt_number: z.string().nullable(),
  notes: z.string().nullable(),
});

export type ReceiptOcrData = z.infer<typeof receiptOcrSchema>;
```

---

## 4. Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        RECEIPT PROCESSING FLOW                            │
└──────────────────────────────────────────────────────────────────────────┘

  ┌─────────┐      ┌─────────────┐      ┌─────────────┐      ┌───────────┐
  │  User   │──────▶│   Upload    │──────▶│   Gemini    │──────▶│  Verify   │
  │ Uploads │      │  Component  │      │   OCR API   │      │   Form    │
  └─────────┘      └─────────────┘      └─────────────┘      └───────────┘
                          │                    │                    │
                          ▼                    ▼                    ▼
                   ┌────────────┐       ┌────────────┐       ┌───────────┐
                   │  Supabase  │       │  raw_ocr   │       │  Supabase │
                   │  Storage   │       │  (JSONB)   │       │  receipts │
                   └────────────┘       └────────────┘       └───────────┘
```

### Stage Descriptions

| Stage | Responsibility | Technology |
|-------|----------------|------------|
| Upload | File validation, compression, storage | Next.js + Supabase Storage |
| OCR | Extract text & structure from image | Gemini 2.0 Flash Vision |
| Verify | User confirms/corrects OCR data | React Form + Zod |
| Save | Persist verified data to database | Server Action + Supabase |

---

## 5. State Management Strategy

### 5.1 Server State (TanStack Query)

```typescript
// All data fetching uses TanStack Query
// src/features/receipts/hooks/use-receipts.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useReceipts() {
  return useQuery({
    queryKey: ["receipts"],
    queryFn: () => fetchReceipts(),
  });
}

export function useCreateReceipt() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createReceipt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
    },
  });
}
```

### 5.2 Client State (Zustand)

```typescript
// UI-only state that doesn't need server sync
// src/stores/ui-store.ts

import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
```

---

## 6. Security Considerations

| Concern | Implementation |
|---------|----------------|
| API Key Protection | Server-side only, never expose to client |
| File Upload Validation | Type checking, size limits, virus scanning (future) |
| SQL Injection | Supabase parameterized queries |
| XSS Prevention | React's built-in escaping + CSP headers |
| Auth Session | Supabase JWT with refresh token rotation |

---

## 7. Environment Variables

```bash
# .env.local (NEVER COMMIT)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx  # Server-side only

# Google Gemini
GOOGLE_GEMINI_API_KEY=AIzaxxx      # Server-side only
```

---

*Document Version: 1.0*  
*Last Updated: 2026-01-19*
