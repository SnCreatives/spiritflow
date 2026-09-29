-- ====================================================================
-- LIQUORFLOW ERP — MAHARASHTRA EXCLUSIVE AUTHENTIC LIQUOR MASTER
-- Migration: 20260927000002_maharashtra_exclusive_master.sql
-- ====================================================================

-- 1. Ensure Categories exist (Whisky, Rum, Vodka, Gin, Brandy, Beer, Wine, Country Liquor, RTD)
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

-- 2. Ensure Manufacturers exist
INSERT INTO manufacturers (name, state, active) VALUES
    ('United Spirits Limited (Diageo India)', 'Maharashtra', TRUE),
    ('Pernod Ricard India Pvt Ltd', 'Maharashtra', TRUE),
    ('Radico Khaitan Limited', 'Maharashtra', TRUE),
    ('Allied Blenders & Distillers Ltd (ABD)', 'Maharashtra', TRUE),
    ('Tilaknagar Industries Ltd', 'Maharashtra', TRUE),
    ('Inbrew Beverages Pvt Ltd', 'Maharashtra', TRUE),
    ('John Distilleries Pvt Ltd', 'Maharashtra', TRUE),
    ('Bacardi India Pvt Ltd', 'Maharashtra', TRUE),
    ('Mohan Meakin Limited', 'Maharashtra', TRUE),
    ('United Breweries Limited (Heineken Group)', 'Maharashtra', TRUE),
    ('Carlsberg India Pvt Ltd', 'Maharashtra', TRUE),
    ('Anheuser-Busch InBev India Ltd (AB InBev)', 'Maharashtra', TRUE),
    ('B9 Beverages Pvt Ltd (Bira 91)', 'Maharashtra', TRUE),
    ('Devans Modern Breweries Ltd', 'Maharashtra', TRUE),
    ('White Owl Brewery Pvt Ltd', 'Maharashtra', TRUE),
    ('Hindustan Breweries Limited', 'Maharashtra', TRUE),
    ('GM Breweries Limited', 'Maharashtra', TRUE),
    ('Sula Vineyards Ltd (Nashik)', 'Maharashtra', TRUE),
    ('Fratelli Wines Pvt Ltd (Akluj/Solapur)', 'Maharashtra', TRUE),
    ('Grover Zampa Vineyards Ltd', 'Maharashtra', TRUE),
    ('York Winery & Vineyards', 'Maharashtra', TRUE),
    ('Charosa Wineries Ltd', 'Maharashtra', TRUE),
    ('Chandon India (Moet Hennessy India)', 'Maharashtra', TRUE),
    ('Vintage Wines Pvt Ltd (Reveilo)', 'Maharashtra', TRUE),
    ('Soma Vineyards', 'Maharashtra', TRUE),
    ('Vallonne Vineyards Pvt Ltd', 'Maharashtra', TRUE),
    ('Rhythm Winery', 'Maharashtra', TRUE),
    ('Nao Spirits & Beverages Pvt Ltd', 'Maharashtra', TRUE),
    ('Third Eye Distillery Pvt Ltd', 'Maharashtra', TRUE),
    ('Piccadily Agro Industries Ltd', 'Maharashtra', TRUE),
    ('Khoday India Limited', 'Maharashtra', TRUE)
ON CONFLICT (name) DO UPDATE SET active = TRUE;

-- 3. Cleanup old/dummy/unverified generic products and brands not in our verified Maharashtra list
DO $$
DECLARE
    v_whisky UUID; v_rum UUID; v_vodka UUID; v_gin UUID; v_brandy UUID; 
    v_beer UUID; v_wine UUID; v_country UUID; v_rtd UUID;
    
    -- MFG IDs
    m_usl UUID; m_pernod UUID; m_radico UUID; m_abd UUID; m_tilak UUID;
    m_inbrew UUID; m_john UUID; m_bacardi UUID; m_meakin UUID; m_ubl UUID;
    m_carlsberg UUID; m_abinbev UUID; m_bira UUID; m_devans UUID; m_whiteowl UUID;
    m_hindustan UUID; m_gm UUID; m_sula UUID; m_fratelli UUID; m_grover UUID;
    m_york UUID; m_charosa UUID; m_chandon UUID; m_reveilo UUID; m_soma UUID;
    m_vallonne UUID; m_rhythm UUID; m_nao UUID; m_thirdeye UUID; m_piccadily UUID; m_khoday UUID;

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
    SELECT id INTO m_usl FROM manufacturers WHERE name LIKE '%United Spirits%';
    SELECT id INTO m_pernod FROM manufacturers WHERE name LIKE '%Pernod Ricard%';
    SELECT id INTO m_radico FROM manufacturers WHERE name LIKE '%Radico%';
    SELECT id INTO m_abd FROM manufacturers WHERE name LIKE '%Allied Blenders%';
    SELECT id INTO m_tilak FROM manufacturers WHERE name LIKE '%Tilaknagar%';
    SELECT id INTO m_inbrew FROM manufacturers WHERE name LIKE '%Inbrew%';
    SELECT id INTO m_john FROM manufacturers WHERE name LIKE '%John Distilleries%';
    SELECT id INTO m_bacardi FROM manufacturers WHERE name LIKE '%Bacardi%';
    SELECT id INTO m_meakin FROM manufacturers WHERE name LIKE '%Mohan Meakin%';
    SELECT id INTO m_ubl FROM manufacturers WHERE name LIKE '%United Breweries%';
    SELECT id INTO m_carlsberg FROM manufacturers WHERE name LIKE '%Carlsberg%';
    SELECT id INTO m_abinbev FROM manufacturers WHERE name LIKE '%InBev%';
    SELECT id INTO m_bira FROM manufacturers WHERE name LIKE '%B9 Beverages%';
    SELECT id INTO m_devans FROM manufacturers WHERE name LIKE '%Devans%';
    SELECT id INTO m_whiteowl FROM manufacturers WHERE name LIKE '%White Owl%';
    SELECT id INTO m_hindustan FROM manufacturers WHERE name LIKE '%Hindustan Breweries%';
    SELECT id INTO m_gm FROM manufacturers WHERE name LIKE '%GM Breweries%';
    SELECT id INTO m_sula FROM manufacturers WHERE name LIKE '%Sula Vineyards%';
    SELECT id INTO m_fratelli FROM manufacturers WHERE name LIKE '%Fratelli%';
    SELECT id INTO m_grover FROM manufacturers WHERE name LIKE '%Grover Zampa%';
    SELECT id INTO m_york FROM manufacturers WHERE name LIKE '%York Winery%';
    SELECT id INTO m_charosa FROM manufacturers WHERE name LIKE '%Charosa%';
    SELECT id INTO m_chandon FROM manufacturers WHERE name LIKE '%Chandon%';
    SELECT id INTO m_reveilo FROM manufacturers WHERE name LIKE '%Vintage Wines%';
    SELECT id INTO m_soma FROM manufacturers WHERE name LIKE '%Soma Vineyards%';
    SELECT id INTO m_vallonne FROM manufacturers WHERE name LIKE '%Vallonne%';
    SELECT id INTO m_rhythm FROM manufacturers WHERE name LIKE '%Rhythm Winery%';
    SELECT id INTO m_nao FROM manufacturers WHERE name LIKE '%Nao Spirits%';
    SELECT id INTO m_thirdeye FROM manufacturers WHERE name LIKE '%Third Eye%';
    SELECT id INTO m_piccadily FROM manufacturers WHERE name LIKE '%Piccadily%';
    SELECT id INTO m_khoday FROM manufacturers WHERE name LIKE '%Khoday%';

    -- Remove Prohibited 500ml Pint for Beer
    IF v_beer IS NOT NULL THEN
        DELETE FROM pack_sizes WHERE category_id = v_beer AND volume_ml = 500 AND pack_type ILIKE '%Pint%';
    END IF;

    -- =========================================================================
    -- 4. INSERT/UPSERT VERIFIED MAHARASHTRA BRANDS
    -- =========================================================================

    -- WHISKY BRANDS
    IF v_whisky IS NOT NULL THEN
        INSERT INTO brands (name, category_id, manufacturer_id, maharashtra_status, active) VALUES
        ('Royal Stag', v_whisky, m_pernod, 'Active', TRUE),
        ('Royal Stag Barrel Select', v_whisky, m_pernod, 'Active', TRUE),
        ('Blenders Pride', v_whisky, m_pernod, 'Active', TRUE),
        ('Imperial Blue', v_whisky, m_pernod, 'Active', TRUE),
        ('McDowell''s No.1 Whisky', v_whisky, m_usl, 'Active', TRUE),
        ('Signature', v_whisky, m_usl, 'Active', TRUE),
        ('Officer''s Choice', v_whisky, m_abd, 'Active', TRUE),
        ('Officer''s Choice Blue', v_whisky, m_abd, 'Active', TRUE),
        ('Sterling Reserve', v_whisky, m_abd, 'Active', TRUE),
        ('Sterling Reserve B7', v_whisky, m_abd, 'Active', TRUE),
        ('8 PM', v_whisky, m_radico, 'Active', TRUE),
        ('Rockford', v_whisky, m_radico, 'Active', TRUE),
        ('Rockford Reserve', v_whisky, m_radico, 'Active', TRUE),
        ('Black Dog', v_whisky, m_usl, 'Active', TRUE),
        ('100 Pipers', v_whisky, m_pernod, 'Active', TRUE),
        ('Ballantine''s', v_whisky, m_pernod, 'Active', TRUE),
        ('Chivas Regal', v_whisky, m_pernod, 'Active', TRUE),
        ('Johnnie Walker Red Label', v_whisky, m_usl, 'Active', TRUE),
        ('Johnnie Walker Black Label', v_whisky, m_usl, 'Active', TRUE),
        ('The Glenlivet', v_whisky, m_pernod, 'Active', TRUE),
        ('Teachers', v_whisky, m_pernod, 'Active', TRUE),
        ('VAT 69', v_whisky, m_usl, 'Active', TRUE),
        ('Antiquity Blue', v_whisky, m_usl, 'Active', TRUE),
        ('Antiquity Rare', v_whisky, m_usl, 'Active', TRUE),
        ('Royal Challenge', v_whisky, m_usl, 'Active', TRUE),
        ('White & Blue', v_whisky, m_abd, 'Active', TRUE),
        ('DSP Black', v_whisky, m_inbrew, 'Active', TRUE),
        ('Original Choice', v_whisky, m_john, 'Active', TRUE),
        ('Director''s Special', v_whisky, m_inbrew, 'Active', TRUE),
        ('Peter Scot', v_whisky, m_khoday, 'Active', TRUE),
        ('Bagpiper', v_whisky, m_inbrew, 'Active', TRUE),
        ('Aristocrat', v_whisky, m_radico, 'Active', TRUE),
        ('Mansion House Whisky', v_whisky, m_tilak, 'Active', TRUE)
        ON CONFLICT (category_id, name) DO UPDATE SET active = TRUE;
    END IF;

    -- RUM BRANDS
    IF v_rum IS NOT NULL THEN
        INSERT INTO brands (name, category_id, manufacturer_id, maharashtra_status, active) VALUES
        ('Old Monk', v_rum, m_meakin, 'Active', TRUE),
        ('Old Monk Supreme', v_rum, m_meakin, 'Active', TRUE),
        ('Old Monk Gold Reserve', v_rum, m_meakin, 'Active', TRUE),
        ('McDowell''s No.1 Celebration Rum', v_rum, m_usl, 'Active', TRUE),
        ('Bacardi Carta Blanca', v_rum, m_bacardi, 'Active', TRUE),
        ('Bacardi Black', v_rum, m_bacardi, 'Active', TRUE),
        ('Bacardi Limon', v_rum, m_bacardi, 'Active', TRUE),
        ('Captain Morgan', v_rum, m_usl, 'Active', TRUE),
        ('Contessa Rum', v_rum, m_radico, 'Active', TRUE),
        ('Hercules Rum', v_rum, m_meakin, 'Active', TRUE),
        ('Maka Zai Rum', v_rum, m_thirdeye, 'Active', TRUE)
        ON CONFLICT (category_id, name) DO UPDATE SET active = TRUE;
    END IF;

    -- VODKA BRANDS
    IF v_vodka IS NOT NULL THEN
        INSERT INTO brands (name, category_id, manufacturer_id, maharashtra_status, active) VALUES
        ('Magic Moments', v_vodka, m_radico, 'Active', TRUE),
        ('Magic Moments Green Apple', v_vodka, m_radico, 'Active', TRUE),
        ('Magic Moments Orange', v_vodka, m_radico, 'Active', TRUE),
        ('Magic Moments Remix', v_vodka, m_radico, 'Active', TRUE),
        ('Smirnoff', v_vodka, m_usl, 'Active', TRUE),
        ('Smirnoff Green Apple', v_vodka, m_usl, 'Active', TRUE),
        ('Smirnoff Orange', v_vodka, m_usl, 'Active', TRUE),
        ('Absolut', v_vodka, m_pernod, 'Active', TRUE),
        ('Absolut Lime', v_vodka, m_pernod, 'Active', TRUE),
        ('Absolut Raspberry', v_vodka, m_pernod, 'Active', TRUE),
        ('Romanov', v_vodka, m_usl, 'Active', TRUE),
        ('White Mischief', v_vodka, m_usl, 'Active', TRUE),
        ('Fuel', v_vodka, m_radico, 'Active', TRUE)
        ON CONFLICT (category_id, name) DO UPDATE SET active = TRUE;
    END IF;

    -- GIN BRANDS
    IF v_gin IS NOT NULL THEN
        INSERT INTO brands (name, category_id, manufacturer_id, maharashtra_status, active) VALUES
        ('Blue Riband Gin', v_gin, m_usl, 'Active', TRUE),
        ('Gordon''s', v_gin, m_usl, 'Active', TRUE),
        ('Gordon''s Pink', v_gin, m_usl, 'Active', TRUE),
        ('Bombay Sapphire', v_gin, m_bacardi, 'Active', TRUE),
        ('Tanqueray', v_gin, m_usl, 'Active', TRUE),
        ('Greater Than', v_gin, m_nao, 'Active', TRUE),
        ('Hapusa', v_gin, m_nao, 'Active', TRUE),
        ('Jaisalmer Indian Craft Gin', v_gin, m_radico, 'Active', TRUE)
        ON CONFLICT (category_id, name) DO UPDATE SET active = TRUE;
    END IF;

    -- BRANDY BRANDS
    IF v_brandy IS NOT NULL THEN
        INSERT INTO brands (name, category_id, manufacturer_id, maharashtra_status, active) VALUES
        ('Mansion House Brandy', v_brandy, m_tilak, 'Active', TRUE),
        ('McDowell''s No.1 Brandy', v_brandy, m_usl, 'Active', TRUE),
        ('Honey Bee', v_brandy, m_usl, 'Active', TRUE),
        ('Morpheus', v_brandy, m_radico, 'Active', TRUE),
        ('Morpheus Blue', v_brandy, m_radico, 'Active', TRUE),
        ('Dreher', v_brandy, m_pernod, 'Active', TRUE),
        ('Mansion House French Brandy', v_brandy, m_tilak, 'Active', TRUE),
        ('St-Rémy', v_brandy, m_pernod, 'Active', TRUE)
        ON CONFLICT (category_id, name) DO UPDATE SET active = TRUE;
    END IF;

    -- BEER BRANDS
    IF v_beer IS NOT NULL THEN
        INSERT INTO brands (name, category_id, manufacturer_id, maharashtra_status, active) VALUES
        ('Kingfisher Premium', v_beer, m_ubl, 'Active', TRUE),
        ('Kingfisher Strong', v_beer, m_ubl, 'Active', TRUE),
        ('Kingfisher Ultra', v_beer, m_ubl, 'Active', TRUE),
        ('Kingfisher Ultra Max', v_beer, m_ubl, 'Active', TRUE),
        ('Kingfisher Blue', v_beer, m_ubl, 'Active', TRUE),
        ('Budweiser', v_beer, m_abinbev, 'Active', TRUE),
        ('Budweiser Magnum', v_beer, m_abinbev, 'Active', TRUE),
        ('Budweiser 0.0', v_beer, m_abinbev, 'Active', TRUE),
        ('Tuborg Green', v_beer, m_carlsberg, 'Active', TRUE),
        ('Tuborg Strong', v_beer, m_carlsberg, 'Active', TRUE),
        ('Carlsberg', v_beer, m_carlsberg, 'Active', TRUE),
        ('Carlsberg Elephant', v_beer, m_carlsberg, 'Active', TRUE),
        ('Heineken', v_beer, m_ubl, 'Active', TRUE),
        ('Heineken Silver', v_beer, m_ubl, 'Active', TRUE),
        ('Corona Extra', v_beer, m_abinbev, 'Active', TRUE),
        ('Corona Premier', v_beer, m_abinbev, 'Active', TRUE),
        ('Foster''s', v_beer, m_ubl, 'Active', TRUE),
        ('Foster''s Strong', v_beer, m_ubl, 'Active', TRUE),
        ('Haywards 5000', v_beer, m_inbrew, 'Active', TRUE),
        ('Haywards 2000', v_beer, m_inbrew, 'Active', TRUE),
        ('bira 91 Blonde', v_beer, m_bira, 'Active', TRUE),
        ('bira 91 Strong', v_beer, m_bira, 'Active', TRUE),
        ('bira 91 White', v_beer, m_bira, 'Active', TRUE),
        ('bira 91 Gold', v_beer, m_bira, 'Active', TRUE),
        ('bira 91 IPA', v_beer, m_bira, 'Active', TRUE),
        ('Miller High Life', v_beer, m_abinbev, 'Active', TRUE),
        ('Miller Ace', v_beer, m_abinbev, 'Active', TRUE),
        ('Hoegaarden', v_beer, m_abinbev, 'Active', TRUE),
        ('Stella Artois', v_beer, m_abinbev, 'Active', TRUE),
        ('Beck''s', v_beer, m_abinbev, 'Active', TRUE),
        ('London Pride', v_beer, m_devans, 'Active', TRUE),
        ('Simba Lager', v_beer, m_hindustan, 'Active', TRUE),
        ('Simba Stout', v_beer, m_hindustan, 'Active', TRUE),
        ('White Owl Spark', v_beer, m_whiteowl, 'Active', TRUE),
        ('White Owl Diablo', v_beer, m_whiteowl, 'Active', TRUE),
        ('White Owl XPA', v_beer, m_whiteowl, 'Active', TRUE)
        ON CONFLICT (category_id, name) DO UPDATE SET active = TRUE;
    END IF;

    -- WINE BRANDS
    IF v_wine IS NOT NULL THEN
        INSERT INTO brands (name, category_id, manufacturer_id, maharashtra_status, active) VALUES
        ('Sula', v_wine, m_sula, 'Active', TRUE),
        ('Sula Brut', v_wine, m_sula, 'Active', TRUE),
        ('Sula Seco', v_wine, m_sula, 'Active', TRUE),
        ('Sula Riesling', v_wine, m_sula, 'Active', TRUE),
        ('Sula Chenin Blanc', v_wine, m_sula, 'Active', TRUE),
        ('Sula Cabernet Shiraz', v_wine, m_sula, 'Active', TRUE),
        ('Sula Zinfandel', v_wine, m_sula, 'Active', TRUE),
        ('Fratelli', v_wine, m_fratelli, 'Active', TRUE),
        ('Fratelli Classic Shiraz', v_wine, m_fratelli, 'Active', TRUE),
        ('Fratelli Classic Chenin Blanc', v_wine, m_fratelli, 'Active', TRUE),
        ('Fratelli Sangiovese Bianco', v_wine, m_fratelli, 'Active', TRUE),
        ('York', v_wine, m_york, 'Active', TRUE),
        ('York Arros', v_wine, m_york, 'Active', TRUE),
        ('York Sparkling', v_wine, m_york, 'Active', TRUE),
        ('Grover Zampa', v_wine, m_grover, 'Active', TRUE),
        ('Reveilo', v_wine, m_reveilo, 'Active', TRUE),
        ('Myra Vineyards', v_wine, m_sula, 'Active', TRUE),
        ('Four Seasons', v_wine, m_usl, 'Active', TRUE),
        ('Nine Hills', v_wine, m_pernod, 'Active', TRUE),
        ('Big Banyan', v_wine, m_john, 'Active', TRUE)
        ON CONFLICT (category_id, name) DO UPDATE SET active = TRUE;
    END IF;

    -- COUNTRY LIQUOR BRANDS (Maharashtra Approved Only)
    IF v_country IS NOT NULL THEN
        INSERT INTO brands (name, category_id, manufacturer_id, maharashtra_status, active) VALUES
        ('GM Santra', v_country, m_gm, 'Active', TRUE),
        ('GM Dilbahar Saunf', v_country, m_gm, 'Active', TRUE),
        ('GM Mauritius Rum', v_country, m_gm, 'Active', TRUE),
        ('Maharashtra Orange CL', v_country, m_gm, 'Active', TRUE),
        ('Maharashtra Saoji CL', v_country, m_gm, 'Active', TRUE)
        ON CONFLICT (category_id, name) DO UPDATE SET active = TRUE;
    END IF;

    -- RTD / PRE-MIXED BRANDS
    IF v_rtd IS NOT NULL THEN
        INSERT INTO brands (name, category_id, manufacturer_id, maharashtra_status, active) VALUES
        ('Bacardi Breezer', v_rtd, m_bacardi, 'Active', TRUE),
        ('Smirnoff Ice', v_rtd, m_usl, 'Active', TRUE)
        ON CONFLICT (category_id, name) DO UPDATE SET active = TRUE;
    END IF;

END $$;
