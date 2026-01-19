# SUGAR-OP Database Schema Draft
> PostgreSQL Schema for Supabase

---

## 1. Schema Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATABASE SCHEMA                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐       ┌──────────────────┐       ┌───────────────┐   │
│   │    users     │───────│     receipts     │───────│  attachments  │   │
│   │  (Supabase)  │  1:N  │                  │  1:N  │               │   │
│   └──────────────┘       └──────────────────┘       └───────────────┘   │
│                                   │                                      │
│                                   │                                      │
│                          ┌────────┴────────┐                            │
│                          │  raw_ocr_data   │                            │
│                          │    (JSONB)      │                            │
│                          │  Audit Trail    │                            │
│                          └─────────────────┘                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ENUM Definitions

```sql
-- Receipt processing status
CREATE TYPE receipt_status AS ENUM (
  'pending',      -- Uploaded, awaiting OCR processing
  'processing',   -- Currently being processed by Gemini
  'completed',    -- Successfully processed and verified
  'failed'        -- OCR processing failed
);

-- Receipt verification status
CREATE TYPE verification_status AS ENUM (
  'unverified',   -- OCR data not yet verified by user
  'verified',     -- User has confirmed OCR data is correct
  'corrected'     -- User has made corrections to OCR data
);
```

---

## 3. Tables

### 3.1 `receipts` Table

```sql
CREATE TABLE receipts (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Key to Supabase Auth
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Status Tracking
  status receipt_status NOT NULL DEFAULT 'pending',
  verification_status verification_status NOT NULL DEFAULT 'unverified',
  
  -- Extracted Data (User-verified)
  receipt_number TEXT,
  transaction_date DATE,
  supplier_name TEXT,
  weight_kg DECIMAL(10, 2),
  price_per_kg DECIMAL(10, 2),
  total_amount DECIMAL(12, 2),
  notes TEXT,
  
  -- OCR Audit Trail
  raw_ocr_data JSONB,                -- Original Gemini response (immutable)
  ocr_confidence_score DECIMAL(3, 2), -- 0.00 to 1.00
  
  -- File Reference
  image_url TEXT NOT NULL,           -- Supabase Storage URL
  image_filename TEXT,
  
  -- Processing Metadata
  processed_at TIMESTAMPTZ,
  processing_duration_ms INTEGER,
  error_message TEXT,                -- Error details if status = 'failed'
  
  -- Audit Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_receipts_user_id ON receipts(user_id);
CREATE INDEX idx_receipts_status ON receipts(status);
CREATE INDEX idx_receipts_transaction_date ON receipts(transaction_date);
CREATE INDEX idx_receipts_created_at ON receipts(created_at DESC);

-- Full-text search on supplier name
CREATE INDEX idx_receipts_supplier_name_gin ON receipts 
  USING GIN (to_tsvector('thai', COALESCE(supplier_name, '')));
```

### 3.2 `raw_ocr_data` JSONB Structure

> [!IMPORTANT]
> The `raw_ocr_data` column stores the **original, unmodified** Gemini response for audit purposes. This data should NEVER be modified after initial insert.

```typescript
// TypeScript interface for raw_ocr_data
interface RawOcrData {
  // Gemini extraction result
  extracted: {
    date: string | null;
    supplier_name: string | null;
    weight_kg: number | null;
    price_per_kg: number | null;
    total_amount: number | null;
    receipt_number: string | null;
    notes: string | null;
  };
  
  // Processing metadata
  metadata: {
    model: string;              // "gemini-2.0-flash"
    processing_time_ms: number;
    prompt_tokens: number;
    completion_tokens: number;
    timestamp: string;          // ISO 8601
  };
  
  // Raw response for debugging
  raw_response?: string;
}
```

### 3.3 `attachments` Table (Future Extension)

```sql
-- For receipts with multiple images
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_receipt_id ON attachments(receipt_id);
```

---

## 4. Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Receipts: Users can only access their own data
CREATE POLICY "Users can view own receipts" ON receipts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own receipts" ON receipts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own receipts" ON receipts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own receipts" ON receipts
  FOR DELETE USING (auth.uid() = user_id);

-- Attachments: Access via parent receipt ownership
CREATE POLICY "Users can access own attachments" ON attachments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM receipts 
      WHERE receipts.id = attachments.receipt_id 
      AND receipts.user_id = auth.uid()
    )
  );
```

---

## 5. Triggers

```sql
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## 6. Views (Dashboard Metrics)

```sql
-- Summary view for dashboard
CREATE VIEW receipt_summary AS
SELECT 
  user_id,
  COUNT(*) AS total_receipts,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_receipts,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_receipts,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_receipts,
  SUM(weight_kg) FILTER (WHERE status = 'completed') AS total_weight_kg,
  SUM(total_amount) FILTER (WHERE status = 'completed') AS total_revenue,
  AVG(price_per_kg) FILTER (WHERE status = 'completed') AS avg_price_per_kg
FROM receipts
GROUP BY user_id;
```

---

## 7. Supabase Storage Buckets

```sql
-- Create storage bucket for receipt images
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false);

-- RLS for storage
CREATE POLICY "Users can upload receipt images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own receipt images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## 8. Migration Script

```sql
-- migrations/001_initial_schema.sql

-- Start transaction
BEGIN;

-- Create ENUMs
CREATE TYPE receipt_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE verification_status AS ENUM ('unverified', 'verified', 'corrected');

-- Create tables
-- [Insert table definitions from above]

-- Create indexes
-- [Insert index definitions from above]

-- Enable RLS
-- [Insert RLS policies from above]

-- Create triggers
-- [Insert trigger definitions from above]

-- Create views
-- [Insert view definitions from above]

COMMIT;
```

---

*Document Version: 1.0*  
*Last Updated: 2026-01-19*
