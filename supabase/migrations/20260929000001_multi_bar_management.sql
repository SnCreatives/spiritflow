-- ====================================================================
-- LIQUORFLOW ERP — MULTI-BAR / MULTI-OUTLET MANAGEMENT SYSTEM
-- Migration: 20260929000001
-- ====================================================================

-- 1. Create Bar Outlets table
CREATE TABLE IF NOT EXISTS bar_outlets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100) DEFAULT 'Maharashtra',
    pincode VARCHAR(10),
    contact_person VARCHAR(255),
    phone VARCHAR(15),
    email VARCHAR(255),
    license_number VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create User-to-Bar access mapping
CREATE TABLE IF NOT EXISTS user_bar_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES owner_credentials(id) ON DELETE CASCADE,
    bar_id UUID NOT NULL REFERENCES bar_outlets(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'Owner',
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, bar_id)
);

-- 3. Add bar_id to transactional tables
-- 3.1 Inventory
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS bar_id UUID REFERENCES bar_outlets(id) ON DELETE CASCADE;
-- 3.2 Batches
ALTER TABLE batches ADD COLUMN IF NOT EXISTS bar_id UUID REFERENCES bar_outlets(id) ON DELETE CASCADE;
-- 3.3 Purchases
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS bar_id UUID REFERENCES bar_outlets(id) ON DELETE CASCADE;
-- 3.4 Stock Adjustments
ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS bar_id UUID REFERENCES bar_outlets(id) ON DELETE CASCADE;
-- 3.5 Stock Ledger
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS bar_id UUID REFERENCES bar_outlets(id) ON DELETE CASCADE;
-- 3.6 Sales Transactions
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS bar_id UUID REFERENCES bar_outlets(id) ON DELETE CASCADE;

-- 4. Create default bar and migrate legacy data if no bars exist
DO $$
DECLARE
    v_bar_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM bar_outlets) THEN
        -- Create the first default bar
        INSERT INTO bar_outlets (name, code, status)
        VALUES ('Main Bar', 'MAIN', 'Active')
        RETURNING id INTO v_bar_id;

        -- Map all existing users to the default bar
        INSERT INTO user_bar_access (user_id, bar_id, role)
        SELECT id, v_bar_id, 'Owner' FROM owner_credentials
        ON CONFLICT DO NOTHING;

        -- Map legacy records to the default bar
        UPDATE inventory SET bar_id = v_bar_id WHERE bar_id IS NULL;
        UPDATE batches SET bar_id = v_bar_id WHERE bar_id IS NULL;
        UPDATE purchases SET bar_id = v_bar_id WHERE bar_id IS NULL;
        UPDATE stock_adjustments SET bar_id = v_bar_id WHERE bar_id IS NULL;
        UPDATE stock_ledger SET bar_id = v_bar_id WHERE bar_id IS NULL;
        UPDATE sales_transactions SET bar_id = v_bar_id WHERE bar_id IS NULL;
    ELSE
        -- If bars already exist, we still want to ensure legacy records have a bar_id if possible
        -- Picking the first bar as default for legacy if bar_id is null
        SELECT id INTO v_bar_id FROM bar_outlets ORDER BY created_at ASC LIMIT 1;
        
        IF v_bar_id IS NOT NULL THEN
            UPDATE inventory SET bar_id = v_bar_id WHERE bar_id IS NULL;
            UPDATE batches SET bar_id = v_bar_id WHERE bar_id IS NULL;
            UPDATE purchases SET bar_id = v_bar_id WHERE bar_id IS NULL;
            UPDATE stock_adjustments SET bar_id = v_bar_id WHERE bar_id IS NULL;
            UPDATE stock_ledger SET bar_id = v_bar_id WHERE bar_id IS NULL;
            UPDATE sales_transactions SET bar_id = v_bar_id WHERE bar_id IS NULL;
        END IF;
    END IF;
END $$;

-- 5. Finalize constraints (bar_id must be NOT NULL after migration)
DO $$
BEGIN
    -- Only set NOT NULL if we have at least one bar (which we should after step 4)
    IF EXISTS (SELECT 1 FROM bar_outlets) THEN
        ALTER TABLE inventory ALTER COLUMN bar_id SET NOT NULL;
        ALTER TABLE batches ALTER COLUMN bar_id SET NOT NULL;
        ALTER TABLE purchases ALTER COLUMN bar_id SET NOT NULL;
        ALTER TABLE stock_adjustments ALTER COLUMN bar_id SET NOT NULL;
        ALTER TABLE stock_ledger ALTER COLUMN bar_id SET NOT NULL;
        -- Sales might be empty or optional depending on flow, but let's be consistent
        UPDATE sales_transactions SET bar_id = (SELECT id FROM bar_outlets ORDER BY created_at ASC LIMIT 1) WHERE bar_id IS NULL;
    END IF;
END $$;

-- 6. Update Unique Constraints for multi-bar isolation
-- Inventory should be unique per (bar_id, product_id)
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_product_id_key;
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS uq_bar_product;
ALTER TABLE inventory ADD CONSTRAINT uq_bar_product UNIQUE (bar_id, product_id);

-- Batches should be unique per (bar_id, product_id, batch_number)
ALTER TABLE batches DROP CONSTRAINT IF EXISTS uq_product_batch;
ALTER TABLE batches DROP CONSTRAINT IF EXISTS uq_bar_product_batch;
ALTER TABLE batches ADD CONSTRAINT uq_bar_product_batch UNIQUE (bar_id, product_id, batch_number);

-- 7. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_bar ON inventory(bar_id);
CREATE INDEX IF NOT EXISTS idx_batches_bar ON batches(bar_id);
CREATE INDEX IF NOT EXISTS idx_purchases_bar ON purchases(bar_id);
CREATE INDEX IF NOT EXISTS idx_stock_adj_bar ON stock_adjustments(bar_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_bar ON stock_ledger(bar_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_bar ON sales_transactions(bar_id);
CREATE INDEX IF NOT EXISTS idx_user_bar_access_user ON user_bar_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bar_access_bar ON user_bar_access(bar_id);
