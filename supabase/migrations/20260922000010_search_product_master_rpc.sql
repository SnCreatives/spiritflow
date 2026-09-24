-- Migration 20260922000010_search_product_master_rpc.sql
-- Description: Stored procedure for product master first search across products, brands, categories, manufacturers, pack sizes, and inventory.

CREATE OR REPLACE FUNCTION search_product_master(p_query text)
RETURNS TABLE (
  id uuid,
  product_name text,
  sku text,
  status text,
  brand_name text,
  category_name text,
  manufacturer_name text,
  pack_size_name text,
  current_stock integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    p.id,
    COALESCE(p.product_name, p.name)::text AS product_name,
    COALESCE(p.sku, '')::text AS sku,
    COALESCE(p.status, 'Active')::text AS status,
    COALESCE(b.brand_name, b.name, '')::text AS brand_name,
    COALESCE(c.name, '')::text AS category_name,
    COALESCE(m.manufacturer_name, m.name, '')::text AS manufacturer_name,
    COALESCE(ps.name, '')::text AS pack_size_name,
    COALESCE(SUM(i.current_quantity), 0)::integer AS current_stock
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN manufacturers m ON m.id = COALESCE(p.manufacturer_id, b.manufacturer_id)
  LEFT JOIN pack_sizes ps ON ps.id = p.pack_size_id
  LEFT JOIN inventory i ON i.product_id = p.id
  WHERE 
    p.name ILIKE ('%' || p_query || '%')
    OR p.product_name ILIKE ('%' || p_query || '%')
    OR p.sku ILIKE ('%' || p_query || '%')
    OR b.brand_name ILIKE ('%' || p_query || '%')
    OR b.name ILIKE ('%' || p_query || '%')
    OR c.name ILIKE ('%' || p_query || '%')
    OR m.manufacturer_name ILIKE ('%' || p_query || '%')
    OR m.name ILIKE ('%' || p_query || '%')
    OR ps.name ILIKE ('%' || p_query || '%')
    OR ps.pack_type ILIKE ('%' || p_query || '%')
  GROUP BY p.id, p.product_name, p.name, p.sku, p.status, b.brand_name, b.name, c.name, m.manufacturer_name, m.name, ps.name
  ORDER BY 
    CASE 
      WHEN LOWER(COALESCE(p.product_name, p.name)) = LOWER(p_query) THEN 1
      WHEN LOWER(COALESCE(p.product_name, p.name)) LIKE (LOWER(p_query) || '%') THEN 2
      WHEN LOWER(COALESCE(p.product_name, p.name)) LIKE ('%' || LOWER(p_query) || '%') THEN 3
      WHEN LOWER(COALESCE(b.brand_name, b.name)) LIKE ('%' || LOWER(p_query) || '%') THEN 4
      ELSE 5
    END,
    product_name ASC
  LIMIT 25;
$$;
