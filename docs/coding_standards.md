# SUGAR-OP Coding Standards
> Development Guidelines & Best Practices

---

## 1. Golden Rules

> [!CAUTION]
> These rules are NON-NEGOTIABLE. Violation requires immediate refactoring.

| # | Rule | Rationale |
|---|------|-----------|
| 1 | **Always use Server Actions for data mutations** | Security, type safety, no API route boilerplate |
| 2 | **Never use `any` type** | All AI responses MUST be parsed by Zod |
| 3 | **Use Optimistic UI updates** | Better UX, especially for slow network |
| 4 | **Gemini responses MUST use `responseMimeType: "application/json"`** | Enforce structured output |
| 5 | **All user inputs MUST be validated with Zod** | Defense in depth |

---

## 2. TypeScript Standards

### 2.1 Strict Type Safety

```typescript
// ❌ FORBIDDEN
const data: any = await geminiResponse.json();
const user = response.data as User;  // Type casting without validation

// ✅ REQUIRED
const data: unknown = await geminiResponse.json();
const validatedData = receiptOcrSchema.parse(data);  // Zod validation

const userResult = userSchema.safeParse(response.data);
if (!userResult.success) {
  throw new ValidationError(userResult.error);
}
const user = userResult.data;
```

### 2.2 Type Imports

```typescript
// ✅ Use type imports for type-only imports
import type { Receipt, ReceiptStatus } from "@/features/receipts/types";
import { createReceipt } from "@/features/receipts/actions";
```

### 2.3 Zod Schema Co-location

```typescript
// ✅ Define Zod schema and infer TypeScript types together
// src/features/receipts/types/receipt.types.ts

import { z } from "zod";

export const receiptSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  supplierName: z.string().nullable(),
  weightKg: z.number().positive().nullable(),
  totalAmount: z.number().nonnegative().nullable(),
});

// Infer type from schema - Single source of truth
export type Receipt = z.infer<typeof receiptSchema>;
```

---

## 3. Server Actions

### 3.1 Structure

```typescript
// src/features/receipts/actions/create-receipt.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/shared/lib/supabase/server";

// Input validation schema
const createReceiptInput = z.object({
  imageBase64: z.string().min(1),
  filename: z.string().optional(),
});

// Action return type
type ActionResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

export async function createReceipt(
  input: z.infer<typeof createReceiptInput>
): Promise<ActionResult<{ id: string }>> {
  try {
    // 1. Validate input
    const validated = createReceiptInput.parse(input);
    
    // 2. Auth check
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }
    
    // 3. Business logic
    const { data, error } = await supabase
      .from("receipts")
      .insert({ user_id: user.id, image_url: validated.imageBase64 })
      .select("id")
      .single();
    
    if (error) throw error;
    
    // 4. Revalidate cache
    revalidatePath("/receipts");
    
    return { success: true, data: { id: data.id } };
    
  } catch (error) {
    console.error("createReceipt error:", error);
    return { 
      success: false, 
      error: error instanceof z.ZodError 
        ? "Invalid input" 
        : "Failed to create receipt" 
    };
  }
}
```

### 3.2 Calling Server Actions

```typescript
// ❌ AVOID: Direct fetch API calls for mutations
const res = await fetch("/api/receipts", { method: "POST", body: ... });

// ✅ REQUIRED: Use Server Actions with TanStack Mutation
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createReceipt } from "@/features/receipts/actions";

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

---

## 4. Optimistic UI Updates

```typescript
// src/features/receipts/hooks/use-delete-receipt.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteReceipt } from "@/features/receipts/actions";
import type { Receipt } from "@/features/receipts/types";

export function useDeleteReceipt() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteReceipt,
    
    // Optimistic update
    onMutate: async (receiptId: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["receipts"] });
      
      // Snapshot previous value
      const previousReceipts = queryClient.getQueryData<Receipt[]>(["receipts"]);
      
      // Optimistically update
      queryClient.setQueryData<Receipt[]>(["receipts"], (old) =>
        old?.filter((r) => r.id !== receiptId)
      );
      
      return { previousReceipts };
    },
    
    // Rollback on error
    onError: (err, receiptId, context) => {
      queryClient.setQueryData(["receipts"], context?.previousReceipts);
    },
    
    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
    },
  });
}
```

---

## 5. Component Standards

### 5.1 File Naming

```
✅ Correct:
  receipt-upload-form.tsx    (kebab-case for files)
  useReceipts.ts             (camelCase for hooks)
  Receipt                    (PascalCase for components/types)

❌ Wrong:
  ReceiptUploadForm.tsx
  use-receipts.ts
  receipt.tsx
```

### 5.2 Component Structure

```typescript
// src/features/receipts/components/receipt-card.tsx
"use client";

import { type FC } from "react";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import type { Receipt } from "../types";

// Props interface at the top
interface ReceiptCardProps {
  receipt: Receipt;
  onEdit?: (id: string) => void;
}

// Named export (not default)
export const ReceiptCard: FC<ReceiptCardProps> = ({ receipt, onEdit }) => {
  return (
    <Card>
      <CardHeader>{receipt.supplierName}</CardHeader>
      <CardContent>
        {/* Content */}
      </CardContent>
    </Card>
  );
};
```

### 5.3 Loading States

```typescript
// ✅ Always handle loading states with skeletons
import { Skeleton } from "@/shared/components/ui/skeleton";

export function ReceiptList() {
  const { data, isLoading } = useReceipts();
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {data?.map((receipt) => (
        <ReceiptCard key={receipt.id} receipt={receipt} />
      ))}
    </div>
  );
}
```

---

## 6. Error Handling

### 6.1 Error Boundaries

```typescript
// src/app/(dashboard)/error.tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/shared/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <h2 className="text-xl font-semibold mb-4">Something went wrong!</h2>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

### 6.2 Toast Notifications

```typescript
// ✅ Use toast for user feedback
import { toast } from "sonner";

const mutation = useCreateReceipt();

const handleSubmit = async (data: FormData) => {
  const result = await mutation.mutateAsync(data);
  
  if (result.success) {
    toast.success("Receipt created successfully");
  } else {
    toast.error(result.error);
  }
};
```

---

## 7. AI/Gemini Integration Rules

### 7.1 Prompt Engineering

```typescript
// ✅ Structured prompts with clear instructions
const OCR_PROMPT = `
You are an OCR specialist for Thai sugarcane transaction receipts.
Your task is to extract structured data from receipt images.

## Output Format
Return a JSON object with the following fields:
- date: string (ISO 8601 format) or null
- supplier_name: string or null
- weight_kg: number or null
- price_per_kg: number or null
- total_amount: number or null
- receipt_number: string or null

## Rules
1. If a field is not clearly visible, return null
2. For numbers, remove thousands separators and convert to pure numbers
3. Dates should be converted to YYYY-MM-DD format
4. Thai text should be preserved as-is
`;
```

### 7.2 Response Validation

```typescript
// ❌ FORBIDDEN: Trust AI output directly
const data = JSON.parse(geminiResponse);
await db.insert(data);

// ✅ REQUIRED: Validate with Zod before any operation
const parseResult = receiptOcrSchema.safeParse(JSON.parse(geminiResponse));

if (!parseResult.success) {
  console.error("OCR validation failed:", parseResult.error);
  return { success: false, error: "Failed to parse receipt" };
}

await db.insert(parseResult.data);
```

---

## 8. Git Commit Standards

```bash
# Format: <type>(<scope>): <subject>

# Types:
feat     # New feature
fix      # Bug fix
docs     # Documentation only
style    # Formatting, missing semicolons, etc.
refactor # Code change that neither fixes bug nor adds feature
test     # Adding tests
chore    # Maintenance

# Examples:
feat(receipts): add OCR processing with Gemini
fix(auth): resolve session refresh race condition
docs(readme): update deployment instructions
```

---

## 9. Environment & Security

### 9.1 Environment Variables

```typescript
// ❌ FORBIDDEN: Direct process.env access scattered in code
const apiKey = process.env.GEMINI_API_KEY;

// ✅ REQUIRED: Centralized config with validation
// src/shared/lib/config.ts
import { z } from "zod";

const envSchema = z.object({
  GOOGLE_GEMINI_API_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export const config = envSchema.parse({
  GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
```

### 9.2 Secrets Handling

```typescript
// ❌ FORBIDDEN: Expose server secrets to client
// In a Client Component:
const apiKey = process.env.GOOGLE_GEMINI_API_KEY; // This would be undefined anyway

// ✅ REQUIRED: Server-side only access via Server Actions
// src/features/receipts/actions/process-ocr.ts
"use server";

const apiKey = process.env.GOOGLE_GEMINI_API_KEY; // Safe in Server Action
```

---

## 10. Code Review Checklist

Before submitting PR, verify:

- [ ] No `any` types used
- [ ] All AI responses validated with Zod
- [ ] Server Actions used for mutations
- [ ] Optimistic updates implemented where applicable
- [ ] Loading states handled with skeletons
- [ ] Error boundaries in place
- [ ] Environment variables validated
- [ ] No hardcoded secrets or URLs
- [ ] Component uses named exports
- [ ] File names follow kebab-case convention

---

*Document Version: 1.0*  
*Last Updated: 2026-01-19*
