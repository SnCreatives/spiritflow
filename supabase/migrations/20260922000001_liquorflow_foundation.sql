-- ====================================================================
-- LIQUORFLOW ERP — PRODUCTION DATABASE SCHEMA & INITIAL MIGRATION
-- Compatible with Supabase PostgreSQL (PostgreSQL 14+)
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. APPLICATION SETUP TABLE
CREATE TABLE IF NOT EXISTS application_setup (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setup_completed BOOLEAN NOT NULL DEFAULT FALSE,
    setup_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. OWNER CREDENTIALS TABLE
CREATE TABLE IF NOT EXISTS owner_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mobile_number VARCHAR(15) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES owner_credentials(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 4. BUSINESS SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name VARCHAR(255) NOT NULL,
    address TEXT,
    owner_mobile VARCHAR(15) NOT NULL,
    vat_number VARCHAR(20),
    licence_reference VARCHAR(100),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    date_format VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
    selected_language VARCHAR(10) NOT NULL DEFAULT 'mr',
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PACK SIZES TABLE
CREATE TABLE IF NOT EXISTS pack_sizes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    volume_ml NUMERIC(10, 2) NOT NULL,
    pack_type VARCHAR(50) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_pack_name UNIQUE(category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_pack_sizes_category ON pack_sizes(category_id);

-- 7. MANUFACTURERS TABLE
CREATE TABLE IF NOT EXISTS manufacturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    state VARCHAR(100) DEFAULT 'Maharashtra',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. BRANDS TABLE
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL,
    maharashtra_status VARCHAR(50) NOT NULL DEFAULT 'Active',
    registration_reference VARCHAR(100),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_brand_name UNIQUE(category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_brands_category ON brands(category_id);

-- 9. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
    manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL,
    pack_size_id UUID NOT NULL REFERENCES pack_sizes(id) ON DELETE RESTRICT,
    sku VARCHAR(100) UNIQUE,
    pack_type VARCHAR(50) NOT NULL,
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    mrp NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    compliance_ref VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'sku') THEN
        CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    END IF;
END $$;

-- 10. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(15),
    licence_number VARCHAR(100),
    vat_number VARCHAR(20),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. PURCHASES TABLE
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    inward_number VARCHAR(100),
    purchase_number VARCHAR(100),
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    tp_permit_ref VARCHAR(100),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'inward_number') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'purchase_number') THEN
            ALTER TABLE purchases ADD COLUMN IF NOT EXISTS inward_number VARCHAR(100);
            UPDATE purchases SET inward_number = purchase_number WHERE inward_number IS NULL;
        ELSE
            ALTER TABLE purchases ADD COLUMN IF NOT EXISTS inward_number VARCHAR(100);
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'purchase_number') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'inward_number') THEN
            ALTER TABLE purchases ADD COLUMN IF NOT EXISTS purchase_number VARCHAR(100);
            UPDATE purchases SET purchase_number = inward_number WHERE purchase_number IS NULL;
        ELSE
            ALTER TABLE purchases ADD COLUMN IF NOT EXISTS purchase_number VARCHAR(100);
        END IF;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'inward_number') THEN
        CREATE INDEX IF NOT EXISTS idx_purchases_inward ON purchases(inward_number);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'purchase_number') THEN
        CREATE INDEX IF NOT EXISTS idx_purchases_number ON purchases(purchase_number);
    END IF;
END $$;

-- 12. PURCHASE ITEMS TABLE
CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id);

-- 13. INVENTORY TABLE
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID UNIQUE NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    opening_stock INTEGER NOT NULL DEFAULT 0 CHECK (opening_stock >= 0),
    purchased_quantity INTEGER NOT NULL DEFAULT 0 CHECK (purchased_quantity >= 0),
    adjustments INTEGER NOT NULL DEFAULT 0,
    current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);

-- 14. STOCK LEDGER TABLE
CREATE TABLE IF NOT EXISTS stock_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transaction_type VARCHAR(50) NOT NULL,
    reference VARCHAR(100),
    stock_in INTEGER NOT NULL DEFAULT 0 CHECK (stock_in >= 0),
    stock_out INTEGER NOT NULL DEFAULT 0 CHECK (stock_out >= 0),
    balance INTEGER NOT NULL CHECK (balance >= 0),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_product ON stock_ledger(product_id);
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_ledger' AND column_name = 'date') THEN
        CREATE INDEX IF NOT EXISTS idx_stock_ledger_date ON stock_ledger(date);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_ledger' AND column_name = 'transaction_date') THEN
        CREATE INDEX IF NOT EXISTS idx_stock_ledger_date ON stock_ledger(transaction_date);
    END IF;
END $$;

-- 15. COMPLIANCE & EXCISE REFERENCES TABLE
CREATE TABLE IF NOT EXISTS compliance_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_type VARCHAR(100) NOT NULL,
    reference_number VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
