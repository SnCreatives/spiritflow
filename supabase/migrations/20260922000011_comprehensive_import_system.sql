-- Migration: 20260922000011_comprehensive_import_system.sql
-- Description: Adds import_logs table and expands import_batches for full audit support. 
-- Adds linkage to all transactional and master data tables.

-- 1. Create import_logs table
CREATE TABLE IF NOT EXISTS import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'SUCCESS', 'FAILED', 'SKIPPED', 'DUPLICATE', 'INVALID'
    error_message TEXT,
    raw_data JSONB,
    processed_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Expand import_batches table with more metadata
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS module VARCHAR(100);
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS source_type VARCHAR(50); -- 'CSV', 'EXCEL', 'PASTE'
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0;
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0;
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS skipped_count INTEGER DEFAULT 0;
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING'; -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ROLLED_BACK'
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS error_summary TEXT;

-- 3. Add import_batch_id to other master tables
ALTER TABLE manufacturers ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;
ALTER TABLE pack_sizes ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;

-- 4. Add import_batch_id to transactional tables for rollback support
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;
ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;

-- 5. Create indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_import_logs_batch_id ON import_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_products_import_batch_id ON products(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_brands_import_batch_id ON brands(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_purchases_import_batch_id ON purchases(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_import_batch_id ON stock_ledger(import_batch_id);
