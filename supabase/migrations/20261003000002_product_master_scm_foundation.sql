-- Migration: 20261003000002_product_master_scm_foundation.sql
-- Objective: Canonical Product Master hierarchy (Product Type -> Brand -> Variant -> Bottle Size -> Packaging)
-- and Maharashtra SCM/Excise Code foundation with effective dating and non-destructive versioning.

-- 1. Extend Categories with Product Type
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS product_type VARCHAR(50);
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS parent_category_id UUID REFERENCES public.categories(id);

-- Update existing category product_types
UPDATE public.categories SET product_type = 'Spirit' WHERE name IN ('Whisky', 'Rum', 'Vodka', 'Gin', 'Brandy', 'Tequila', 'Liqueur') AND product_type IS NULL;
UPDATE public.categories SET product_type = 'Wine' WHERE name = 'Wine' AND product_type IS NULL;
UPDATE public.categories SET product_type = 'Fermented Beer' WHERE name = 'Beer' AND product_type IS NULL;

-- Ensure Mild Beer and Fermented Beer exist
INSERT INTO public.categories (name, code, active, product_type)
VALUES 
  ('Mild Beer', 'MILD_BEER', true, 'Mild Beer'),
  ('Fermented Beer', 'FERMENTED_BEER', true, 'Fermented Beer')
ON CONFLICT (name) DO UPDATE SET product_type = EXCLUDED.product_type;

-- 2. Extend Products with Variant, Product Type, Supplier Item Code, and TP Number
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variant VARCHAR(150);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_type VARCHAR(50);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_item_code VARCHAR(100);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tp_number VARCHAR(100);

-- Backfill existing products
UPDATE public.products SET variant = COALESCE(product_name, name) WHERE variant IS NULL;
UPDATE public.products p 
SET product_type = c.product_type 
FROM public.categories c 
WHERE p.category_id = c.id AND p.product_type IS NULL;

-- 3. Create SCM Codes Table for Maharashtra Excise Regulatory Codes
CREATE TABLE IF NOT EXISTS public.scm_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scm_code VARCHAR(100) NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant VARCHAR(150),
  bottle_size VARCHAR(50),
  packaging_type VARCHAR(50) DEFAULT 'Bottle',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  supplier_item_code VARCHAR(100),
  excise_reference VARCHAR(150),
  source_reference VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_scm_code_effective UNIQUE (scm_code, product_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_scm_codes_product_id ON public.scm_codes(product_id);
CREATE INDEX IF NOT EXISTS idx_scm_codes_code ON public.scm_codes(scm_code);
CREATE INDEX IF NOT EXISTS idx_scm_codes_active ON public.scm_codes(is_active);

-- Enable RLS on scm_codes
ALTER TABLE public.scm_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active scm_codes" ON public.scm_codes;
CREATE POLICY "Public can view active scm_codes" ON public.scm_codes
  FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Service role has full access to scm_codes" ON public.scm_codes;
CREATE POLICY "Service role has full access to scm_codes" ON public.scm_codes
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
