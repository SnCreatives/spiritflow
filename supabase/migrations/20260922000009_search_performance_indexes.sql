-- Migration 20260922000009_search_performance_indexes.sql
-- Description: Adds indexes for fast product master search across product names, brands, categories, SKUs, pack sizes, and manufacturers.

CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_product_name ON products (product_name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_brands_brand_name ON brands (brand_name);
CREATE INDEX IF NOT EXISTS idx_brands_name ON brands (name);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (name);
CREATE INDEX IF NOT EXISTS idx_manufacturers_name ON manufacturers (manufacturer_name);
CREATE INDEX IF NOT EXISTS idx_pack_sizes_name ON pack_sizes (name);
