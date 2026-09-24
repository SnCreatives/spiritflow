-- ====================================================================
-- LIQUORFLOW ERP — MASTER DATA & VAT MIGRATION (Prompt 2)
-- Compatible with Supabase PostgreSQL
-- ====================================================================

-- 1. Ensure VAT Column Exists (Replacing GST)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'settings' AND column_name = 'gst_number'
    ) THEN
        ALTER TABLE settings RENAME COLUMN gst_number TO vat_number;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'suppliers' AND column_name = 'gst_number'
    ) THEN
        ALTER TABLE suppliers RENAME COLUMN gst_number TO vat_number;
    END IF;
END $$;

-- 2. Ensure Contact / Licence Reference column on manufacturers if needed
ALTER TABLE manufacturers ADD COLUMN IF NOT EXISTS licence_number VARCHAR(100);
ALTER TABLE manufacturers ADD COLUMN IF NOT EXISTS contact_number VARCHAR(20);

-- 3. Additional index for performant search across products and brands
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products(name);
CREATE INDEX IF NOT EXISTS idx_brands_name_trgm ON brands(name);
