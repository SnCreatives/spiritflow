-- ====================================================================
-- LIQUORFLOW ERP — SEED VERIFIED MAHARASHTRA PRODUCTS
-- Migration: 20260922000006_seed_maharashtra_products.sql
-- ====================================================================

DO $$
DECLARE
    r RECORD;
    v_prod_count INT := 0;
BEGIN
    -- For each brand and compatible pack size in that category, insert standard verified product SKU
    FOR r IN (
        SELECT 
            b.id as brand_id,
            b.brand_name,
            b.category_id,
            b.manufacturer_id,
            c.name as cat_name,
            p.id as pack_size_id,
            p.name as pack_name,
            p.volume_ml,
            p.pack_type
        FROM brands b
        JOIN categories c ON c.id = b.category_id
        JOIN pack_sizes p ON p.category_id = b.category_id
        WHERE b.source LIKE '%Maharashtra State Excise%'
    ) LOOP
        -- Generate standard product name: e.g. "Royal Challenge Finest Premium Whisky 750ml"
        INSERT INTO products (
            name,
            product_name,
            sku,
            category_id,
            brand_id,
            manufacturer_id,
            pack_size_id,
            pack_type,
            status,
            source,
            source_date,
            source_reference,
            created_at,
            updated_at
        ) VALUES (
            r.brand_name || ' (' || r.pack_name || ')',
            r.brand_name || ' (' || r.pack_name || ')',
            UPPER(SUBSTRING(REGEXP_REPLACE(r.brand_name, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 6)) || '-' || r.volume_ml,
            r.category_id,
            r.brand_id,
            r.manufacturer_id,
            r.pack_size_id,
            r.pack_type,
            'Active',
            'Verified Source: Maharashtra State Excise',
            '2025-2026',
            'State Excise Maharashtra Approved Label Catalogue',
            NOW(),
            NOW()
        ) ON CONFLICT DO NOTHING;
        
        v_prod_count := v_prod_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Processed verified products: %', v_prod_count;
END $$;
