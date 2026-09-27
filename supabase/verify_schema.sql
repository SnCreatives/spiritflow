-- ============================================================================
-- SPIRITFLOW / LIQUORFLOW ERP - DATABASE SCHEMA VERIFICATION & INTEGRITY AUDIT
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_liquorflow_schema()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  count BIGINT,
  description TEXT
) AS $$
DECLARE
  orphan_brands BIGINT;
  orphan_products BIGINT;
  orphan_pack_sizes BIGINT;
  orphan_purchases BIGINT;
  orphan_purchase_items BIGINT;
  orphan_ledger BIGINT;
  negative_inventory BIGINT;
  invalid_prices BIGINT;
BEGIN
  -- 1. Check orphan brands (brands without valid category_id)
  SELECT COUNT(*) INTO orphan_brands
  FROM brands b
  LEFT JOIN categories c ON b.category_id = c.id
  WHERE c.id IS NULL;

  check_name := 'Orphan Brands Check';
  status := CASE WHEN orphan_brands = 0 THEN 'PASS' ELSE 'FAIL' END;
  count := orphan_brands;
  description := 'Brands referencing non-existent categories';
  RETURN NEXT;

  -- 2. Check orphan products (products without valid brand or category)
  SELECT COUNT(*) INTO orphan_products
  FROM products p
  LEFT JOIN brands b ON p.brand_id = b.id
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE b.id IS NULL OR c.id IS NULL;

  check_name := 'Orphan Products Check';
  status := CASE WHEN orphan_products = 0 THEN 'PASS' ELSE 'FAIL' END;
  count := orphan_products;
  description := 'Products referencing non-existent brands or categories';
  RETURN NEXT;

  -- 3. Check inventory stock negative values
  SELECT COUNT(*) INTO negative_inventory
  FROM inventory
  WHERE current_stock < 0;

  check_name := 'Negative Inventory Check';
  status := CASE WHEN negative_inventory = 0 THEN 'PASS' ELSE 'FAIL' END;
  count := negative_inventory;
  description := 'Inventory items with negative stock quantities';
  RETURN NEXT;

  -- 4. Check purchase items without valid purchases
  SELECT COUNT(*) INTO orphan_purchase_items
  FROM purchase_items pi
  LEFT JOIN purchases p ON pi.purchase_id = p.id
  WHERE p.id IS NULL;

  check_name := 'Orphan Purchase Items Check';
  status := CASE WHEN orphan_purchase_items = 0 THEN 'PASS' ELSE 'FAIL' END;
  count := orphan_purchase_items;
  description := 'Purchase items without parent purchase record';
  RETURN NEXT;

  -- 5. Check stock ledger records without valid products
  SELECT COUNT(*) INTO orphan_ledger
  FROM stock_ledger sl
  LEFT JOIN products p ON sl.product_id = p.id
  WHERE p.id IS NULL;

  check_name := 'Orphan Stock Ledger Check';
  status := CASE WHEN orphan_ledger = 0 THEN 'PASS' ELSE 'FAIL' END;
  count := orphan_ledger;
  description := 'Stock ledger records referencing non-existent products';
  RETURN NEXT;

  -- 6. Check invalid product prices (MRP <= 0 or purchase price < 0)
  SELECT COUNT(*) INTO invalid_prices
  FROM products
  WHERE mrp <= 0 OR purchase_price < 0;

  check_name := 'Product Pricing Validity Check';
  status := CASE WHEN invalid_prices = 0 THEN 'PASS' ELSE 'FAIL' END;
  count := invalid_prices;
  description := 'Products with zero/negative MRP or negative purchase price';
  RETURN NEXT;

END;
$$ LANGUAGE plpgsql;

-- Execute audit function
SELECT * FROM audit_liquorflow_schema();
