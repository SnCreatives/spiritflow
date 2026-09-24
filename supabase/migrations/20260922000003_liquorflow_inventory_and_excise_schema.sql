-- ====================================================================
-- LIQUORFLOW ERP — COMPREHENSIVE INVENTORY & EXCISE DATABASE SCHEMA
-- Prompt 3: Production Migration
-- Architecture: Inventory + Stock Management + Excise Management ONLY
-- Strictly NO Sales, POS, Customer Billing, or Payments
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 2. CLEANUP: REMOVE UNWANTED SALES / POS ARTIFACTS SAFELY
-- ====================================================================
DO $$
BEGIN
    -- Safely drop sales & POS tables if they exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sale_items') THEN
        DROP TABLE sale_items CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') THEN
        DROP TABLE sales CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        DROP TABLE payments CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
        DROP TABLE customers CASCADE;
    END IF;
END $$;

-- ====================================================================
-- 3. CORE APPLICATION & SETTINGS TABLES
-- ====================================================================

-- 3.1 Application Setup
CREATE TABLE IF NOT EXISTS application_setup (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setup_completed BOOLEAN NOT NULL DEFAULT FALSE,
    setup_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 Owner Credentials
CREATE TABLE IF NOT EXISTS owner_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mobile_number VARCHAR(15) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.3 Sessions
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

-- 3.4 Settings (Strictly VAT, No GST)
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name VARCHAR(255) NOT NULL,
    business_address TEXT NOT NULL,
    owner_mobile VARCHAR(15) NOT NULL,
    vat_number VARCHAR(50),
    licence_reference VARCHAR(100),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    date_format VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
    language VARCHAR(10) NOT NULL DEFAULT 'mr',
    low_stock_threshold INTEGER NOT NULL DEFAULT 10,
    stock_valuation_method VARCHAR(50) NOT NULL DEFAULT 'FIFO',
    purchase_prefix VARCHAR(20) NOT NULL DEFAULT 'PUR',
    adjustment_prefix VARCHAR(20) NOT NULL DEFAULT 'ADJ',
    excise_reference_prefix VARCHAR(20) NOT NULL DEFAULT 'EXC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure settings column compatibility if table was pre-existing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'business_address') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'address') THEN
            ALTER TABLE settings RENAME COLUMN address TO business_address;
        ELSE
            ALTER TABLE settings ADD COLUMN business_address TEXT DEFAULT '';
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'language') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'selected_language') THEN
            ALTER TABLE settings RENAME COLUMN selected_language TO language;
        ELSE
            ALTER TABLE settings ADD COLUMN language VARCHAR(10) DEFAULT 'mr';
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'stock_valuation_method') THEN
        ALTER TABLE settings ADD COLUMN stock_valuation_method VARCHAR(50) DEFAULT 'FIFO';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'purchase_prefix') THEN
        ALTER TABLE settings ADD COLUMN purchase_prefix VARCHAR(20) DEFAULT 'PUR';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'adjustment_prefix') THEN
        ALTER TABLE settings ADD COLUMN adjustment_prefix VARCHAR(20) DEFAULT 'ADJ';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'excise_reference_prefix') THEN
        ALTER TABLE settings ADD COLUMN excise_reference_prefix VARCHAR(20) DEFAULT 'EXC';
    END IF;
END $$;

-- ====================================================================
-- 4. MASTER DATA TABLES
-- ====================================================================

-- 4.1 Categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial categories (Whisky, Beer, Wine, Rum, Vodka, Brandy, MML, Fermented Beer, Other)
INSERT INTO categories (name, code, active)
VALUES 
    ('Whisky', 'WHISKY', TRUE),
    ('Beer', 'BEER', TRUE),
    ('Wine', 'WINE', TRUE),
    ('Rum', 'RUM', TRUE),
    ('Vodka', 'VODKA', TRUE),
    ('Brandy', 'BRANDY', TRUE),
    ('MML', 'MML', TRUE),
    ('Fermented Beer', 'FERMENTED_BEER', TRUE),
    ('Other', 'OTHER', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 4.2 Manufacturers
CREATE TABLE IF NOT EXISTS manufacturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manufacturer_name VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    address TEXT,
    state VARCHAR(100) DEFAULT 'Maharashtra',
    contact_number VARCHAR(20),
    registration_reference VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_manufacturer_name UNIQUE (manufacturer_name)
);

-- Backwards compatibility sync for manufacturer name
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'manufacturers' AND column_name = 'manufacturer_name') THEN
        ALTER TABLE manufacturers ADD COLUMN manufacturer_name VARCHAR(255);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'manufacturers' AND column_name = 'name') THEN
        UPDATE manufacturers SET manufacturer_name = name WHERE manufacturer_name IS NULL OR manufacturer_name = '';
    END IF;
END $$;

-- 4.3 Brands
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_name VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    maharashtra_applicability VARCHAR(50) NOT NULL DEFAULT 'Active',
    registration_reference VARCHAR(100),
    compliance_reference VARCHAR(100),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_brand_name UNIQUE (category_id, brand_name)
);

CREATE INDEX IF NOT EXISTS idx_brands_category ON brands(category_id);
CREATE INDEX IF NOT EXISTS idx_brands_manufacturer ON brands(manufacturer_id);

-- Backwards compatibility sync for brand name
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'brand_name') THEN
        ALTER TABLE brands ADD COLUMN brand_name VARCHAR(255);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'name') THEN
        UPDATE brands SET brand_name = name WHERE brand_name IS NULL OR brand_name = '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'maharashtra_applicability') THEN
        ALTER TABLE brands ADD COLUMN maharashtra_applicability VARCHAR(50) DEFAULT 'Active';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'compliance_reference') THEN
        ALTER TABLE brands ADD COLUMN compliance_reference VARCHAR(100);
    END IF;
END $$;

-- 4.4 Pack Sizes
CREATE TABLE IF NOT EXISTS pack_sizes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    volume_ml NUMERIC(10, 2) NOT NULL CHECK (volume_ml > 0),
    pack_type VARCHAR(50) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_pack_name UNIQUE(category_id, name),
    CONSTRAINT chk_pack_size_not_500_pint CHECK (NOT (volume_ml = 500 AND LOWER(pack_type) = 'pint'))
);

CREATE INDEX IF NOT EXISTS idx_pack_sizes_category ON pack_sizes(category_id);

-- Seed initial pack sizes
DO $$
DECLARE
    v_whisky_id UUID;
    v_beer_id UUID;
BEGIN
    SELECT id INTO v_whisky_id FROM categories WHERE name = 'Whisky' LIMIT 1;
    SELECT id INTO v_beer_id FROM categories WHERE name = 'Beer' LIMIT 1;

    -- Whisky: 2 L Bottle
    IF v_whisky_id IS NOT NULL THEN
        INSERT INTO pack_sizes (category_id, name, volume_ml, pack_type, active)
        VALUES (v_whisky_id, '2 L Bottle', 2000, 'Bottle', TRUE)
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;

    -- Beer: 275 ml Can, 330 ml Can, 330 ml Pint, 500 ml Can (NEVER 500 ml Pint)
    IF v_beer_id IS NOT NULL THEN
        INSERT INTO pack_sizes (category_id, name, volume_ml, pack_type, active)
        VALUES 
            (v_beer_id, '275 ml Can', 275, 'Can', TRUE),
            (v_beer_id, '330 ml Can', 330, 'Can', TRUE),
            (v_beer_id, '330 ml Pint', 330, 'Pint', TRUE),
            (v_beer_id, '500 ml Can', 500, 'Can', TRUE)
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;

-- 4.5 Products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_name VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
    manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL,
    sku VARCHAR(100) UNIQUE,
    pack_size_id UUID NOT NULL REFERENCES pack_sizes(id) ON DELETE RESTRICT,
    pack_type VARCHAR(50) NOT NULL,
    purchase_tp_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (purchase_tp_price >= 0),
    mrp_reference NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (mrp_reference >= 0),
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (selling_price >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    compliance_reference VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_product_status CHECK (status IN ('Active', 'Inactive'))
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_pack ON products(pack_size_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- Backwards compatibility sync for products
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'product_name') THEN
        ALTER TABLE products ADD COLUMN product_name VARCHAR(255);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'name') THEN
        UPDATE products SET product_name = name WHERE product_name IS NULL OR product_name = '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'purchase_tp_price') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'purchase_price') THEN
            ALTER TABLE products RENAME COLUMN purchase_price TO purchase_tp_price;
        ELSE
            ALTER TABLE products ADD COLUMN purchase_tp_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'mrp_reference') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'mrp') THEN
            ALTER TABLE products RENAME COLUMN mrp TO mrp_reference;
        ELSE
            ALTER TABLE products ADD COLUMN mrp_reference NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'compliance_reference') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'compliance_ref') THEN
            ALTER TABLE products RENAME COLUMN compliance_ref TO compliance_reference;
        ELSE
            ALTER TABLE products ADD COLUMN compliance_reference VARCHAR(100);
        END IF;
    END IF;
END $$;

-- 4.6 Suppliers (Strictly VAT, No GST)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_name VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    address TEXT,
    contact_number VARCHAR(20),
    mobile VARCHAR(20),
    email VARCHAR(255),
    licence_reference VARCHAR(100),
    vat_number VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backwards compatibility sync for suppliers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'supplier_name') THEN
        ALTER TABLE suppliers ADD COLUMN supplier_name VARCHAR(255);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'name') THEN
        UPDATE suppliers SET supplier_name = name WHERE supplier_name IS NULL OR supplier_name = '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'contact_number') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'mobile') THEN
            ALTER TABLE suppliers ADD COLUMN contact_number VARCHAR(20);
            UPDATE suppliers SET contact_number = mobile WHERE contact_number IS NULL;
        END IF;
    END IF;
END $$;

-- ====================================================================
-- 5. INVENTORY & STOCK TABLES
-- ====================================================================

-- 5.1 Batches
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_number VARCHAR(100) NOT NULL,
    batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    purchase_tp_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (purchase_tp_value >= 0),
    mrp_reference NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (mrp_reference >= 0),
    excise_reference VARCHAR(100),
    document_reference VARCHAR(100),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_batch UNIQUE (product_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_batches_product ON batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_date ON batches(batch_date);

-- 5.2 Purchases / Inward Stock
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
    purchase_number VARCHAR(100) UNIQUE NOT NULL,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    tp_permit_reference VARCHAR(100),
    excise_reference VARCHAR(100),
    document_reference VARCHAR(100),
    total_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_value >= 0),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backwards compatibility sync for purchases
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'purchase_number') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'inward_number') THEN
            ALTER TABLE purchases RENAME COLUMN inward_number TO purchase_number;
        ELSE
            ALTER TABLE purchases ADD COLUMN purchase_number VARCHAR(100) UNIQUE;
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'tp_permit_reference') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'tp_permit_ref') THEN
            ALTER TABLE purchases RENAME COLUMN tp_permit_ref TO tp_permit_reference;
        ELSE
            ALTER TABLE purchases ADD COLUMN tp_permit_reference VARCHAR(100);
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'total_value') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'total_amount') THEN
            ALTER TABLE purchases RENAME COLUMN total_amount TO total_value;
        ELSE
            ALTER TABLE purchases ADD COLUMN total_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'excise_reference') THEN
        ALTER TABLE purchases ADD COLUMN excise_reference VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'document_reference') THEN
        ALTER TABLE purchases ADD COLUMN document_reference VARCHAR(100);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_number ON purchases(purchase_number);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);

-- 5.3 Purchase Items
CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    purchase_tp_price NUMERIC(12, 2) NOT NULL CHECK (purchase_tp_price >= 0),
    total_value NUMERIC(12, 2) NOT NULL CHECK (total_value >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backwards compatibility sync for purchase_items
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'purchase_tp_price') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'purchase_price') THEN
            ALTER TABLE purchase_items RENAME COLUMN purchase_price TO purchase_tp_price;
        ELSE
            ALTER TABLE purchase_items ADD COLUMN purchase_tp_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'total_value') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'total') THEN
            ALTER TABLE purchase_items RENAME COLUMN total TO total_value;
        ELSE
            ALTER TABLE purchase_items ADD COLUMN total_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'batch_id') THEN
        ALTER TABLE purchase_items ADD COLUMN batch_id UUID REFERENCES batches(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_batch ON purchase_items(batch_id);

-- 5.4 Inventory (One record per product, strictly non-negative)
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID UNIQUE NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    opening_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (opening_quantity >= 0),
    purchased_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (purchased_quantity >= 0),
    adjustment_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
    returned_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0),
    current_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
    stock_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (stock_value >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_inventory_non_negative CHECK (current_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);

-- Migrate older inventory schema columns if present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'opening_stock') THEN
        ALTER TABLE inventory RENAME COLUMN opening_stock TO opening_quantity;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'current_stock') THEN
        ALTER TABLE inventory RENAME COLUMN current_stock TO current_quantity;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'adjustments') THEN
        ALTER TABLE inventory RENAME COLUMN adjustments TO adjustment_quantity;
    END IF;
    -- Remove sold_quantity if present
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'sold_quantity') THEN
        ALTER TABLE inventory DROP COLUMN sold_quantity;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'returned_quantity') THEN
        ALTER TABLE inventory ADD COLUMN returned_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'stock_value') THEN
        ALTER TABLE inventory ADD COLUMN stock_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (stock_value >= 0);
    END IF;
END $$;

-- 5.5 Stock Adjustments
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adjustment_number VARCHAR(100) UNIQUE NOT NULL,
    adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
    adjustment_type VARCHAR(50) NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    reference VARCHAR(100),
    reason VARCHAR(255),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_adjustment_type CHECK (
        adjustment_type IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN', 'RETURN_OUT', 'CORRECTION')
    )
);

CREATE INDEX IF NOT EXISTS idx_stock_adj_product ON stock_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_adj_date ON stock_adjustments(adjustment_date);

-- 5.6 Stock Ledger (Strictly NO SALE transactions)
CREATE TABLE IF NOT EXISTS stock_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transaction_type VARCHAR(50) NOT NULL,
    reference_id UUID,
    reference_number VARCHAR(100),
    stock_in NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (stock_in >= 0),
    stock_out NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (stock_out >= 0),
    balance NUMERIC(12, 2) NOT NULL CHECK (balance >= 0),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ledger_tx_type CHECK (
        transaction_type IN ('OPENING', 'PURCHASE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN', 'RETURN_OUT', 'CORRECTION', 'Opening', 'Purchase', 'Sale', 'Adjustment', 'Return', 'Correction')
    )
);

-- Backwards compatibility sync for stock_ledger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_ledger' AND column_name = 'transaction_date') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_ledger' AND column_name = 'date') THEN
            ALTER TABLE stock_ledger RENAME COLUMN date TO transaction_date;
        ELSE
            ALTER TABLE stock_ledger ADD COLUMN transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW();
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_ledger' AND column_name = 'reference_number') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_ledger' AND column_name = 'reference') THEN
            ALTER TABLE stock_ledger RENAME COLUMN reference TO reference_number;
        ELSE
            ALTER TABLE stock_ledger ADD COLUMN reference_number VARCHAR(100);
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_ledger' AND column_name = 'reference_id') THEN
        ALTER TABLE stock_ledger ADD COLUMN reference_id UUID;
    END IF;
    ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS chk_ledger_tx_type;
    ALTER TABLE stock_ledger ADD CONSTRAINT chk_ledger_tx_type CHECK (
        transaction_type IN ('OPENING', 'PURCHASE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN', 'RETURN_OUT', 'CORRECTION', 'Opening', 'Purchase', 'Sale', 'Adjustment', 'Return', 'Correction')
    );
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_ledger_product ON stock_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_date ON stock_ledger(transaction_date);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_type ON stock_ledger(transaction_type);

-- ====================================================================
-- 6. EXCISE MANAGEMENT TABLES
-- ====================================================================

-- 6.1 Excise Licences
CREATE TABLE IF NOT EXISTS excise_licences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    licence_type VARCHAR(100) NOT NULL,
    licence_number VARCHAR(100) UNIQUE NOT NULL,
    issue_date DATE,
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    issuing_authority VARCHAR(255) NOT NULL,
    business_reference VARCHAR(100),
    document_reference VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_excise_licence_number ON excise_licences(licence_number);
CREATE INDEX IF NOT EXISTS idx_excise_licence_status ON excise_licences(status);
CREATE INDEX IF NOT EXISTS idx_excise_licence_dates ON excise_licences(valid_from, valid_to);

-- 6.2 Excise Document References
CREATE TABLE IF NOT EXISTS excise_document_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_type VARCHAR(50) NOT NULL,
    reference_number VARCHAR(100) NOT NULL,
    reference_date DATE NOT NULL DEFAULT CURRENT_DATE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
    purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
    quantity NUMERIC(12, 2),
    document_reference VARCHAR(255),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_excise_doc_type CHECK (
        reference_type IN ('TP_PERMIT', 'TRANSPORT', 'INWARD', 'LICENCE', 'EXCISE_DOCUMENT', 'OTHER')
    )
);

CREATE INDEX IF NOT EXISTS idx_excise_doc_ref ON excise_document_references(reference_number);
CREATE INDEX IF NOT EXISTS idx_excise_doc_type ON excise_document_references(reference_type);
CREATE INDEX IF NOT EXISTS idx_excise_doc_product ON excise_document_references(product_id);
CREATE INDEX IF NOT EXISTS idx_excise_doc_purchase ON excise_document_references(purchase_id);

-- 6.3 Compliance References
CREATE TABLE IF NOT EXISTS compliance_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_type VARCHAR(100) NOT NULL,
    reference_number VARCHAR(100) NOT NULL,
    manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
    excise_document_id UUID REFERENCES excise_document_references(id) ON DELETE SET NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_ref_number ON compliance_references(reference_number);
CREATE INDEX IF NOT EXISTS idx_compliance_ref_type ON compliance_references(reference_type);

-- ====================================================================
-- 7. DATABASE LEVEL INTEGRITY & CONSISTENCY TRIGGERS
-- ====================================================================

-- Function to validate Category -> Brand -> Product consistency at the database level
CREATE OR REPLACE FUNCTION validate_product_brand_category_consistency()
RETURNS TRIGGER AS $$
DECLARE
    v_brand_category_id UUID;
    v_pack_category_id UUID;
BEGIN
    -- Verify that the brand's category matches the product's category
    SELECT category_id INTO v_brand_category_id
    FROM brands
    WHERE id = NEW.brand_id;

    IF v_brand_category_id IS NOT NULL AND v_brand_category_id <> NEW.category_id THEN
        RAISE EXCEPTION 'Category mismatch: Brand belongs to category % but product was assigned category %',
            v_brand_category_id, NEW.category_id;
    END IF;

    -- Verify that the pack size's category matches the product's category
    SELECT category_id INTO v_pack_category_id
    FROM pack_sizes
    WHERE id = NEW.pack_size_id;

    IF v_pack_category_id IS NOT NULL AND v_pack_category_id <> NEW.category_id THEN
        RAISE EXCEPTION 'Category mismatch: Pack Size belongs to category % but product was assigned category %',
            v_pack_category_id, NEW.category_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_product_consistency ON products;
CREATE TRIGGER trg_validate_product_consistency
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION validate_product_brand_category_consistency();

-- Function to ensure Inventory matches formula: Current = Opening + Purchased + Adjustments + Returned
CREATE OR REPLACE FUNCTION update_inventory_current_stock()
RETURNS TRIGGER AS $$
BEGIN
    NEW.current_quantity := NEW.opening_quantity + NEW.purchased_quantity + NEW.adjustment_quantity + NEW.returned_quantity;
    IF NEW.current_quantity < 0 THEN
        RAISE EXCEPTION 'Stock violation: Current stock cannot be negative (calculated: %)', NEW.current_quantity;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_stock_calc ON inventory;
CREATE TRIGGER trg_inventory_stock_calc
BEFORE INSERT OR UPDATE ON inventory
FOR EACH ROW
EXECUTE FUNCTION update_inventory_current_stock();

-- ====================================================================
-- 8. SCHEMA MIGRATION TRACKING TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (migration_name)
VALUES ('20260922000003_liquorflow_inventory_and_excise_schema')
ON CONFLICT (migration_name) DO NOTHING;
