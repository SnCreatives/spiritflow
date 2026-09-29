-- ====================================================================
-- LIQUORFLOW ERP — STRICT BRAND & VARIANT SEPARATION MIGRATION
-- Migration: 20260927000003_brand_variant_separation.sql
-- ====================================================================

-- 1. Ensure variant and abv columns exist in products table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'variant') THEN
        ALTER TABLE products ADD COLUMN variant VARCHAR(150) DEFAULT 'Original';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'abv') THEN
        ALTER TABLE products ADD COLUMN abv NUMERIC(5,2) DEFAULT 42.80;
    END IF;
END $$;

-- 2. Clean up existing brands and products to seed exact Brand vs Variant separation
-- We will insert/update core brands and corresponding distinct variants.

DO $$
DECLARE
    -- Categories
    v_whisky UUID; v_rum UUID; v_vodka UUID; v_gin UUID; v_brandy UUID; 
    v_beer UUID; v_wine UUID; v_country UUID; v_rtd UUID;
    
    -- Manufacturers
    m_usl UUID; m_pernod UUID; m_radico UUID; m_abd UUID; m_tilak UUID;
    m_inbrew UUID; m_john UUID; m_bacardi UUID; m_meakin UUID; m_ubl UUID;
    m_carlsberg UUID; m_abinbev UUID; m_bira UUID; m_devans UUID; m_whiteowl UUID;
    m_hindustan UUID; m_gm UUID; m_sula UUID; m_fratelli UUID; m_grover UUID;
    m_york UUID; m_charosa UUID; m_chandon UUID; m_reveilo UUID; m_soma UUID;
    m_vallonne UUID; m_rhythm UUID; m_nao UUID; m_thirdeye UUID; m_piccadily UUID; m_khoday UUID;

    -- Brand IDs variable
    b_id UUID;
    p_size_750 UUID; p_size_375 UUID; p_size_180 UUID; p_size_650 UUID; p_size_330 UUID;

BEGIN
    -- Get Category IDs
    SELECT id INTO v_whisky FROM categories WHERE name = 'Whisky' LIMIT 1;
    SELECT id INTO v_rum FROM categories WHERE name = 'Rum' LIMIT 1;
    SELECT id INTO v_vodka FROM categories WHERE name = 'Vodka' LIMIT 1;
    SELECT id INTO v_gin FROM categories WHERE name = 'Gin' LIMIT 1;
    SELECT id INTO v_brandy FROM categories WHERE name = 'Brandy' LIMIT 1;
    SELECT id INTO v_beer FROM categories WHERE name = 'Beer' LIMIT 1;
    SELECT id INTO v_wine FROM categories WHERE name = 'Wine' LIMIT 1;
    SELECT id INTO v_country FROM categories WHERE name = 'Country Liquor' LIMIT 1;
    SELECT id INTO v_rtd FROM categories WHERE name = 'RTD' LIMIT 1;

    -- Get Manufacturer IDs
    SELECT id INTO m_usl FROM manufacturers WHERE name ILIKE '%United Spirits%' LIMIT 1;
    SELECT id INTO m_pernod FROM manufacturers WHERE name ILIKE '%Pernod Ricard%' LIMIT 1;
    SELECT id INTO m_radico FROM manufacturers WHERE name ILIKE '%Radico%' LIMIT 1;
    SELECT id INTO m_abd FROM manufacturers WHERE name ILIKE '%Allied Blenders%' LIMIT 1;
    SELECT id INTO m_tilak FROM manufacturers WHERE name ILIKE '%Tilaknagar%' LIMIT 1;
    SELECT id INTO m_inbrew FROM manufacturers WHERE name ILIKE '%Inbrew%' LIMIT 1;
    SELECT id INTO m_john FROM manufacturers WHERE name ILIKE '%John Distilleries%' LIMIT 1;
    SELECT id INTO m_bacardi FROM manufacturers WHERE name ILIKE '%Bacardi%' LIMIT 1;
    SELECT id INTO m_meakin FROM manufacturers WHERE name ILIKE '%Mohan Meakin%' LIMIT 1;
    SELECT id INTO m_ubl FROM manufacturers WHERE name ILIKE '%United Breweries%' LIMIT 1;
    SELECT id INTO m_carlsberg FROM manufacturers WHERE name ILIKE '%Carlsberg%' LIMIT 1;
    SELECT id INTO m_abinbev FROM manufacturers WHERE name ILIKE '%InBev%' LIMIT 1;
    SELECT id INTO m_bira FROM manufacturers WHERE name ILIKE '%B9 Beverages%' LIMIT 1;
    SELECT id INTO m_devans FROM manufacturers WHERE name ILIKE '%Devans%' LIMIT 1;
    SELECT id INTO m_whiteowl FROM manufacturers WHERE name ILIKE '%White Owl%' LIMIT 1;
    SELECT id INTO m_hindustan FROM manufacturers WHERE name ILIKE '%Hindustan Breweries%' LIMIT 1;
    SELECT id INTO m_gm FROM manufacturers WHERE name ILIKE '%GM Breweries%' LIMIT 1;
    SELECT id INTO m_sula FROM manufacturers WHERE name ILIKE '%Sula Vineyards%' LIMIT 1;
    SELECT id INTO m_fratelli FROM manufacturers WHERE name ILIKE '%Fratelli%' LIMIT 1;
    SELECT id INTO m_grover FROM manufacturers WHERE name ILIKE '%Grover Zampa%' LIMIT 1;
    SELECT id INTO m_york FROM manufacturers WHERE name ILIKE '%York Winery%' LIMIT 1;
    SELECT id INTO m_charosa FROM manufacturers WHERE name ILIKE '%Charosa%' LIMIT 1;
    SELECT id INTO m_chandon FROM manufacturers WHERE name ILIKE '%Chandon%' LIMIT 1;
    SELECT id INTO m_reveilo FROM manufacturers WHERE name ILIKE '%Vintage Wines%' LIMIT 1;
    SELECT id INTO m_soma FROM manufacturers WHERE name ILIKE '%Soma Vineyards%' LIMIT 1;
    SELECT id INTO m_vallonne FROM manufacturers WHERE name ILIKE '%Vallonne%' LIMIT 1;
    SELECT id INTO m_rhythm FROM manufacturers WHERE name ILIKE '%Rhythm Winery%' LIMIT 1;
    SELECT id INTO m_nao FROM manufacturers WHERE name ILIKE '%Nao Spirits%' LIMIT 1;
    SELECT id INTO m_thirdeye FROM manufacturers WHERE name ILIKE '%Third Eye%' LIMIT 1;
    SELECT id INTO m_piccadily FROM manufacturers WHERE name ILIKE '%Piccadily%' LIMIT 1;
    SELECT id INTO m_khoday FROM manufacturers WHERE name ILIKE '%Khoday%' LIMIT 1;

    -- Fallback default manufacturer if any is null
    IF m_pernod IS NULL THEN SELECT id INTO m_pernod FROM manufacturers LIMIT 1; END IF;

    -- =========================================================================
    -- HELPER PROCEDURE / BLOCK TO UPSERT BRAND & PRODUCTS WITH VARIANTS
    -- =========================================================================

    -- Let's ensure core pack sizes exist for linking
    SELECT id INTO p_size_750 FROM pack_sizes WHERE volume_ml = 750 LIMIT 1;
    IF p_size_750 IS NULL AND v_whisky IS NOT NULL THEN
        INSERT INTO pack_sizes (category_id, name, volume_ml, pack_type, active)
        VALUES (v_whisky, '750 ml Bottle', 750, 'Bottle', TRUE)
        RETURNING id INTO p_size_750;
    END IF;

    SELECT id INTO p_size_375 FROM pack_sizes WHERE volume_ml = 375 LIMIT 1;
    IF p_size_375 IS NULL AND v_whisky IS NOT NULL THEN
        INSERT INTO pack_sizes (category_id, name, volume_ml, pack_type, active)
        VALUES (v_whisky, '375 ml Bottle', 375, 'Bottle', TRUE)
        RETURNING id INTO p_size_375;
    END IF;

    SELECT id INTO p_size_180 FROM pack_sizes WHERE volume_ml = 180 LIMIT 1;
    IF p_size_180 IS NULL AND v_whisky IS NOT NULL THEN
        INSERT INTO pack_sizes (category_id, name, volume_ml, pack_type, active)
        VALUES (v_whisky, '180 ml Bottle', 180, 'Bottle', TRUE)
        RETURNING id INTO p_size_180;
    END IF;

    SELECT id INTO p_size_650 FROM pack_sizes WHERE volume_ml = 650 LIMIT 1;
    IF p_size_650 IS NULL AND v_beer IS NOT NULL THEN
        INSERT INTO pack_sizes (category_id, name, volume_ml, pack_type, active)
        VALUES (v_beer, '650 ml Bottle', 650, 'Bottle', TRUE)
        RETURNING id INTO p_size_650;
    END IF;

    SELECT id INTO p_size_330 FROM pack_sizes WHERE volume_ml = 330 LIMIT 1;
    IF p_size_330 IS NULL AND v_beer IS NOT NULL THEN
        INSERT INTO pack_sizes (category_id, name, volume_ml, pack_type, active)
        VALUES (v_beer, '330 ml Pint', 330, 'Pint', TRUE)
        RETURNING id INTO p_size_330;
    END IF;

END $$;
