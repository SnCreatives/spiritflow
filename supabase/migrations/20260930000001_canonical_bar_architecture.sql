-- ============================================================================
-- LIQUORFLOW ERP — CANONICAL MULTI-BAR ARCHITECTURE & AUTHORIZATION SCHEMA
-- Migration: 20260930000001_canonical_bar_architecture.sql
-- ============================================================================

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. CANONICAL BAR TABLE: public.bar_outlets
-- Only canonical table for bars. Database-generated UUID primary key.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bar_outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    owner_user_id UUID REFERENCES public.owner_credentials(id) ON DELETE SET NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100) DEFAULT 'Maharashtra',
    pincode VARCHAR(10),
    contact_person VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    license_number VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure required columns exist if table was previously created with partial schema
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bar_outlets' AND column_name = 'owner_user_id') THEN
        ALTER TABLE public.bar_outlets ADD COLUMN owner_user_id UUID REFERENCES public.owner_credentials(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bar_outlets' AND column_name = 'status') THEN
        ALTER TABLE public.bar_outlets ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Active';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bar_outlets' AND column_name = 'code') THEN
        ALTER TABLE public.bar_outlets ADD COLUMN code VARCHAR(50);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. BAR AUTHORIZATION TABLE: public.bar_user_authorizations
-- Strictly maps users to bars with unique(bar_id, user_id) constraint.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bar_user_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bar_id UUID NOT NULL REFERENCES public.bar_outlets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.owner_credentials(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'Owner',
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_bar_user_authorizations UNIQUE(bar_id, user_id)
);

-- Backward compatibility: mirror/view user_bar_access if accessed by legacy modules
CREATE TABLE IF NOT EXISTS public.user_bar_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.owner_credentials(id) ON DELETE CASCADE,
    bar_id UUID NOT NULL REFERENCES public.bar_outlets(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'Owner',
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_bar_access UNIQUE(user_id, bar_id)
);

-- ----------------------------------------------------------------------------
-- 3. BAR OWNERSHIP & AUTOMATIC AUTHORIZATION TRIGGER
-- When a bar is created, the owner automatically receives authorization.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_bar_outlets_auto_authorise()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.owner_user_id IS NOT NULL THEN
        -- Insert into canonical bar_user_authorizations
        INSERT INTO public.bar_user_authorizations (bar_id, user_id, role, status)
        VALUES (NEW.id, NEW.owner_user_id, 'Owner', 'Active')
        ON CONFLICT (bar_id, user_id) DO NOTHING;

        -- Insert into backward-compatible user_bar_access
        INSERT INTO public.user_bar_access (user_id, bar_id, role, status)
        VALUES (NEW.owner_user_id, NEW.id, 'Owner', 'Active')
        ON CONFLICT (user_id, bar_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_bar_owner_authorization ON public.bar_outlets;
CREATE TRIGGER trg_auto_bar_owner_authorization
AFTER INSERT ON public.bar_outlets
FOR EACH ROW
EXECUTE FUNCTION trg_fn_bar_outlets_auto_authorise();

-- ----------------------------------------------------------------------------
-- 4. OPERATIONAL RELATIONSHIPS (All point to public.bar_outlets(id))
-- ----------------------------------------------------------------------------

-- 4.1 Purchases & Inward
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS bar_id UUID REFERENCES public.bar_outlets(id) ON DELETE CASCADE;
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS bar_id UUID REFERENCES public.bar_outlets(id) ON DELETE CASCADE;

-- 4.2 Inventory (Must be bar-specific)
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS bar_id UUID REFERENCES public.bar_outlets(id) ON DELETE CASCADE;

-- 4.3 Batches
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS bar_id UUID REFERENCES public.bar_outlets(id) ON DELETE CASCADE;

-- 4.4 Stock Adjustments
ALTER TABLE public.stock_adjustments ADD COLUMN IF NOT EXISTS bar_id UUID REFERENCES public.bar_outlets(id) ON DELETE CASCADE;

-- 4.5 Stock Ledger (Stock movements must belong to bar)
ALTER TABLE public.stock_ledger ADD COLUMN IF NOT EXISTS bar_id UUID REFERENCES public.bar_outlets(id) ON DELETE CASCADE;

-- 4.6 Sales Transactions
ALTER TABLE public.sales_transactions ADD COLUMN IF NOT EXISTS bar_id UUID REFERENCES public.bar_outlets(id) ON DELETE CASCADE;
ALTER TABLE public.sales_transaction_items ADD COLUMN IF NOT EXISTS bar_id UUID REFERENCES public.bar_outlets(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- 5. BAR-SPECIFIC INVENTORY CONSTRAINT
-- Enforce UNIQUE(bar_id, product_id) on inventory so quantities are separate.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory') THEN
        -- Remove legacy non-bar unique constraint if exists
        ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_product_id_key;
        -- Add bar-scoped unique constraint if not exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'uq_inventory_bar_product'
        ) THEN
            ALTER TABLE public.inventory ADD CONSTRAINT uq_inventory_bar_product UNIQUE (bar_id, product_id);
        END IF;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Continue safely
END $$;

-- ----------------------------------------------------------------------------
-- 6. DEFAULT BAR PROVISIONING FOR PRE-EXISTING DATA
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_default_bar_id UUID;
    v_default_owner_id UUID;
BEGIN
    -- Check if owner exists
    SELECT id INTO v_default_owner_id FROM public.owner_credentials WHERE active = true ORDER BY created_at ASC LIMIT 1;

    -- Ensure at least one bar exists
    IF NOT EXISTS (SELECT 1 FROM public.bar_outlets) THEN
        INSERT INTO public.bar_outlets (name, code, owner_user_id, status)
        VALUES ('Main Bar Outlet', 'MAIN', v_default_owner_id, 'Active')
        RETURNING id INTO v_default_bar_id;

        -- Authorize all existing active owners
        IF v_default_owner_id IS NOT NULL THEN
            INSERT INTO public.bar_user_authorizations (bar_id, user_id, role, status)
            VALUES (v_default_bar_id, v_default_owner_id, 'Owner', 'Active')
            ON CONFLICT (bar_id, user_id) DO NOTHING;
        END IF;

        -- Migrate unassigned legacy operational rows to the default bar
        UPDATE public.purchases SET bar_id = v_default_bar_id WHERE bar_id IS NULL;
        UPDATE public.purchase_items SET bar_id = v_default_bar_id WHERE bar_id IS NULL;
        UPDATE public.inventory SET bar_id = v_default_bar_id WHERE bar_id IS NULL;
        UPDATE public.batches SET bar_id = v_default_bar_id WHERE bar_id IS NULL;
        UPDATE public.stock_adjustments SET bar_id = v_default_bar_id WHERE bar_id IS NULL;
        UPDATE public.stock_ledger SET bar_id = v_default_bar_id WHERE bar_id IS NULL;
        UPDATE public.sales_transactions SET bar_id = v_default_bar_id WHERE bar_id IS NULL;
        UPDATE public.sales_transaction_items SET bar_id = v_default_bar_id WHERE bar_id IS NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.bar_outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_user_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bar_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access on bar_outlets" ON public.bar_outlets;
CREATE POLICY "Service role full access on bar_outlets" ON public.bar_outlets FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access on bar_user_authorizations" ON public.bar_user_authorizations;
CREATE POLICY "Service role full access on bar_user_authorizations" ON public.bar_user_authorizations FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access on user_bar_access" ON public.user_bar_access;
CREATE POLICY "Service role full access on user_bar_access" ON public.user_bar_access FOR ALL USING (true);

-- ----------------------------------------------------------------------------
-- 8. INDEXES FOR HIGH-PERFORMANCE MULTI-BAR FILTERING
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bar_outlets_owner ON public.bar_outlets(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_bar_authorizations_bar ON public.bar_user_authorizations(bar_id);
CREATE INDEX IF NOT EXISTS idx_bar_authorizations_user ON public.bar_user_authorizations(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_bar_id ON public.purchases(bar_id);
CREATE INDEX IF NOT EXISTS idx_inventory_bar_id ON public.inventory(bar_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_bar_id ON public.stock_ledger(bar_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_bar_id ON public.stock_adjustments(bar_id);
