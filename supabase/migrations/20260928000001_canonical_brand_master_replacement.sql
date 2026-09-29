-- ====================================================================
-- LIQUORFLOW ERP — CANONICAL BRAND MASTER REPLACEMENT
-- Migration: 20260928000001_canonical_brand_master_replacement.sql
-- ====================================================================

DO $$
DECLARE
    v_whisky UUID;
    v_rum UUID;
    v_vodka UUID;
    v_gin UUID;
    v_brandy UUID;
    v_beer UUID;
    v_wine UUID;
    v_default_mfg UUID;
BEGIN
    -- 1. Ensure Categories exist
    INSERT INTO categories (name, code, active) VALUES
        ('Whisky', 'WHISKY', TRUE),
        ('Rum', 'RUM', TRUE),
        ('Vodka', 'VODKA', TRUE),
        ('Gin', 'GIN', TRUE),
        ('Brandy', 'BRANDY', TRUE),
        ('Beer', 'BEER', TRUE),
        ('Wine', 'WINE', TRUE),
        ('Country Liquor', 'COUNTRY_LIQUOR', TRUE),
        ('RTD', 'RTD', TRUE)
    ON CONFLICT (name) DO UPDATE SET active = TRUE;

    SELECT id INTO v_whisky FROM categories WHERE name = 'Whisky' LIMIT 1;
    SELECT id INTO v_rum FROM categories WHERE name = 'Rum' LIMIT 1;
    SELECT id INTO v_vodka FROM categories WHERE name = 'Vodka' LIMIT 1;
    SELECT id INTO v_gin FROM categories WHERE name = 'Gin' LIMIT 1;
    SELECT id INTO v_brandy FROM categories WHERE name = 'Brandy' LIMIT 1;
    SELECT id INTO v_beer FROM categories WHERE name = 'Beer' LIMIT 1;
    SELECT id INTO v_wine FROM categories WHERE name = 'Wine' LIMIT 1;

    SELECT id INTO v_default_mfg FROM manufacturers LIMIT 1;

    -- Create temporary table of the exact canonical brands requested
    CREATE TEMP TABLE _canonical_brands (
        category_id UUID NOT NULL,
        brand_name VARCHAR(150) NOT NULL
    ) ON COMMIT DROP;

    -- WHISKY (32)
    INSERT INTO _canonical_brands (category_id, brand_name) VALUES
        (v_whisky, 'Royal Stag'),
        (v_whisky, 'Royal Stag Barrel Select'),
        (v_whisky, 'Blenders Pride'),
        (v_whisky, 'Blenders Pride Reserve Collection'),
        (v_whisky, 'Imperial Blue'),
        (v_whisky, 'McDowell''s No.1'),
        (v_whisky, 'Signature'),
        (v_whisky, 'Signature Premier'),
        (v_whisky, 'Officer''s Choice'),
        (v_whisky, 'Officer''s Choice Blue'),
        (v_whisky, 'Sterling Reserve'),
        (v_whisky, 'Sterling Reserve B7'),
        (v_whisky, '8 PM'),
        (v_whisky, 'Rockford'),
        (v_whisky, 'Rockford Reserve'),
        (v_whisky, 'Antiquity Blue'),
        (v_whisky, 'Antiquity Rare'),
        (v_whisky, 'Royal Challenge'),
        (v_whisky, 'DSP Black'),
        (v_whisky, 'Director''s Special'),
        (v_whisky, 'Peter Scot'),
        (v_whisky, 'Bagpiper'),
        (v_whisky, 'Aristocrat'),
        (v_whisky, 'White & Blue'),
        (v_whisky, 'Black Dog'),
        (v_whisky, '100 Pipers'),
        (v_whisky, 'Ballantine''s'),
        (v_whisky, 'Chivas Regal'),
        (v_whisky, 'Johnnie Walker'),
        (v_whisky, 'Teacher''s'),
        (v_whisky, 'VAT 69'),
        (v_whisky, 'The Glenlivet');

    -- RUM (11)
    INSERT INTO _canonical_brands (category_id, brand_name) VALUES
        (v_rum, 'Old Monk'),
        (v_rum, 'Old Monk Supreme'),
        (v_rum, 'Old Monk Gold Reserve'),
        (v_rum, 'McDowell''s No.1 Celebration'),
        (v_rum, 'Bacardi'),
        (v_rum, 'Bacardi Carta Blanca'),
        (v_rum, 'Bacardi Black'),
        (v_rum, 'Captain Morgan'),
        (v_rum, 'Contessa'),
        (v_rum, 'Hercules'),
        (v_rum, 'Maka Zai');

    -- VODKA (9)
    INSERT INTO _canonical_brands (category_id, brand_name) VALUES
        (v_vodka, 'Magic Moments'),
        (v_vodka, 'Magic Moments Green Apple'),
        (v_vodka, 'Magic Moments Orange'),
        (v_vodka, 'Magic Moments Remix'),
        (v_vodka, 'Smirnoff'),
        (v_vodka, 'Absolut'),
        (v_vodka, 'Romanov'),
        (v_vodka, 'White Mischief'),
        (v_vodka, 'Fuel');

    -- GIN (8)
    INSERT INTO _canonical_brands (category_id, brand_name) VALUES
        (v_gin, 'Blue Riband'),
        (v_gin, 'Gordon''s'),
        (v_gin, 'Gordon''s Pink'),
        (v_gin, 'Bombay Sapphire'),
        (v_gin, 'Tanqueray'),
        (v_gin, 'Greater Than'),
        (v_gin, 'Hapusa'),
        (v_gin, 'Jaisalmer');

    -- BRANDY (7)
    INSERT INTO _canonical_brands (category_id, brand_name) VALUES
        (v_brandy, 'Mansion House'),
        (v_brandy, 'McDowell''s No.1 Brandy'),
        (v_brandy, 'Honey Bee'),
        (v_brandy, 'Morpheus'),
        (v_brandy, 'Morpheus Blue'),
        (v_brandy, 'Dreher'),
        (v_brandy, 'St-Rémy');

    -- BEER (31)
    INSERT INTO _canonical_brands (category_id, brand_name) VALUES
        (v_beer, 'Kingfisher'),
        (v_beer, 'Kingfisher Premium'),
        (v_beer, 'Kingfisher Strong'),
        (v_beer, 'Kingfisher Ultra'),
        (v_beer, 'Kingfisher Ultra Max'),
        (v_beer, 'Kingfisher Blue'),
        (v_beer, 'Budweiser'),
        (v_beer, 'Budweiser Magnum'),
        (v_beer, 'Tuborg'),
        (v_beer, 'Tuborg Strong'),
        (v_beer, 'Carlsberg'),
        (v_beer, 'Carlsberg Elephant'),
        (v_beer, 'Heineken'),
        (v_beer, 'Heineken Silver'),
        (v_beer, 'Corona Extra'),
        (v_beer, 'Corona Premier'),
        (v_beer, 'Foster''s'),
        (v_beer, 'Haywards 5000'),
        (v_beer, 'Haywards 2000'),
        (v_beer, 'bira 91'),
        (v_beer, 'bira 91 Blonde'),
        (v_beer, 'bira 91 Strong'),
        (v_beer, 'bira 91 White'),
        (v_beer, 'bira 91 Gold'),
        (v_beer, 'bira 91 IPA'),
        (v_beer, 'Hoegaarden'),
        (v_beer, 'Stella Artois'),
        (v_beer, 'Beck''s'),
        (v_beer, 'Simba'),
        (v_beer, 'White Owl'),
        (v_beer, 'Miller');

    -- WINE (9)
    INSERT INTO _canonical_brands (category_id, brand_name) VALUES
        (v_wine, 'Sula'),
        (v_wine, 'Fratelli'),
        (v_wine, 'York'),
        (v_wine, 'Grover Zampa'),
        (v_wine, 'Reveilo'),
        (v_wine, 'Myra'),
        (v_wine, 'Four Seasons'),
        (v_wine, 'Nine Hills'),
        (v_wine, 'Big Banyan');

    -- 2. Insert or update all canonical brands
    INSERT INTO brands (name, brand_name, category_id, manufacturer_id, maharashtra_status, maharashtra_applicability, active, source, source_date, source_reference)
    SELECT
        cb.brand_name,
        cb.brand_name,
        cb.category_id,
        v_default_mfg,
        'Approved',
        'Active',
        TRUE,
        'Verified Source: Maharashtra State Excise',
        '2025-2026',
        'State Excise Maharashtra Approved Brand Register'
    FROM _canonical_brands cb
    ON CONFLICT (category_id, name) DO UPDATE
    SET
        brand_name = EXCLUDED.name,
        maharashtra_status = 'Approved',
        maharashtra_applicability = 'Active',
        active = TRUE;

    -- 3. Reassign products referencing old/non-canonical brands to the appropriate canonical brand
    -- First, map specific known legacy brand names to their new canonical names
    UPDATE products p
    SET brand_id = new_b.id
    FROM brands old_b, brands new_b
    WHERE p.brand_id = old_b.id
      AND new_b.category_id = old_b.category_id
      AND (
        (old_b.name = 'McDowell''s No.1 Whisky' AND new_b.name = 'McDowell''s No.1') OR
        (old_b.name IN ('Johnnie Walker Red Label', 'Johnnie Walker Black Label') AND new_b.name = 'Johnnie Walker') OR
        (old_b.name = 'Teachers' AND new_b.name = 'Teacher''s') OR
        (old_b.name = 'McDowell''s No.1 Celebration Rum' AND new_b.name = 'McDowell''s No.1 Celebration') OR
        (old_b.name = 'Bacardi Limon' AND new_b.name = 'Bacardi') OR
        (old_b.name = 'Contessa Rum' AND new_b.name = 'Contessa') OR
        (old_b.name = 'Hercules Rum' AND new_b.name = 'Hercules') OR
        (old_b.name = 'Maka Zai Rum' AND new_b.name = 'Maka Zai') OR
        (old_b.name IN ('Smirnoff Green Apple', 'Smirnoff Orange') AND new_b.name = 'Smirnoff') OR
        (old_b.name IN ('Absolut Lime', 'Absolut Raspberry') AND new_b.name = 'Absolut') OR
        (old_b.name = 'Blue Riband Gin' AND new_b.name = 'Blue Riband') OR
        (old_b.name = 'Jaisalmer Indian Craft Gin' AND new_b.name = 'Jaisalmer') OR
        (old_b.name IN ('Mansion House Brandy', 'Mansion House French Brandy') AND new_b.name = 'Mansion House') OR
        (old_b.name = 'Budweiser 0.0' AND new_b.name = 'Budweiser') OR
        (old_b.name = 'Tuborg Green' AND new_b.name = 'Tuborg') OR
        (old_b.name = 'Foster''s Strong' AND new_b.name = 'Foster''s') OR
        (old_b.name IN ('Miller High Life', 'Miller Ace') AND new_b.name = 'Miller') OR
        (old_b.name IN ('Simba Lager', 'Simba Stout') AND new_b.name = 'Simba') OR
        (old_b.name IN ('White Owl Spark', 'White Owl Diablo', 'White Owl XPA') AND new_b.name = 'White Owl') OR
        (old_b.name ILIKE 'Bira 91%' AND new_b.name = 'bira 91') OR
        (old_b.name ILIKE 'Sula%' AND new_b.name = 'Sula') OR
        (old_b.name ILIKE 'Fratelli%' AND new_b.name = 'Fratelli') OR
        (old_b.name ILIKE 'York%' AND new_b.name = 'York') OR
        (old_b.name = 'Myra Vineyards' AND new_b.name = 'Myra')
      );

    -- For any remaining products pointing to a brand not in _canonical_brands,
    -- reassign to the first canonical brand in the same category (or Royal Stag if category has none)
    UPDATE products p
    SET brand_id = COALESCE(
        (
            SELECT b2.id
            FROM brands b2
            INNER JOIN _canonical_brands cb ON cb.category_id = b2.category_id AND cb.brand_name = b2.name
            WHERE b2.category_id = p.category_id
            ORDER BY b2.name ASC
            LIMIT 1
        ),
        (
            SELECT b3.id
            FROM brands b3
            INNER JOIN _canonical_brands cb ON cb.category_id = b3.category_id AND cb.brand_name = b3.name
            WHERE b3.name = 'Royal Stag'
            LIMIT 1
        )
    )
    WHERE NOT EXISTS (
        SELECT 1
        FROM brands b
        INNER JOIN _canonical_brands cb ON cb.category_id = b.category_id AND cb.brand_name = b.name
        WHERE b.id = p.brand_id
    );

    -- Ensure product category_id matches its brand's category_id
    UPDATE products p
    SET category_id = b.category_id
    FROM brands b
    WHERE p.brand_id = b.id
      AND p.category_id IS DISTINCT FROM b.category_id;

    -- 4. Delete all brands not in the canonical list
    DELETE FROM brands b
    WHERE NOT EXISTS (
        SELECT 1
        FROM _canonical_brands cb
        WHERE cb.category_id = b.category_id
          AND cb.brand_name = b.name
    );

END $$;
