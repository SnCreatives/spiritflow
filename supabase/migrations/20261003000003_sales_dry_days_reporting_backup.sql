-- Migration: 20261003000003_sales_dry_days_reporting_backup.sql
-- Objective: Support Sales ERP, Dry Days, Category Tax Rules, and Bar-Scoped Backups/Restores.

-- 1. Dry Days Management (Bar-specific and State-wide)
CREATE TABLE IF NOT EXISTS public.dry_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID REFERENCES public.bar_outlets(id) ON DELETE CASCADE,
  dry_date DATE NOT NULL,
  reason VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dry_day_bar_date UNIQUE (bar_id, dry_date)
);

CREATE INDEX IF NOT EXISTS idx_dry_days_date ON public.dry_days(dry_date);
CREATE INDEX IF NOT EXISTS idx_dry_days_bar ON public.dry_days(bar_id);

ALTER TABLE public.dry_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read dry days" ON public.dry_days;
CREATE POLICY "Public read dry days" ON public.dry_days FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "Service role full access dry days" ON public.dry_days;
CREATE POLICY "Service role full access dry days" ON public.dry_days FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Category Tax Rules (Wine: 0%, Spirits/Beer: Configured rate)
CREATE TABLE IF NOT EXISTS public.tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name VARCHAR(100) NOT NULL UNIQUE,
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read tax rules" ON public.tax_rules;
CREATE POLICY "Public read tax rules" ON public.tax_rules FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "Service role full access tax rules" ON public.tax_rules;
CREATE POLICY "Service role full access tax rules" ON public.tax_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed canonical tax rules
INSERT INTO public.tax_rules (category_name, tax_rate, is_active)
VALUES 
  ('Wine', 0.00, true),
  ('Spirit', 5.00, true),
  ('Whisky', 5.00, true),
  ('Rum', 5.00, true),
  ('Vodka', 5.00, true),
  ('Gin', 5.00, true),
  ('Brandy', 5.00, true),
  ('Tequila', 5.00, true),
  ('Liqueur', 5.00, true),
  ('Mild Beer', 5.00, true),
  ('Fermented Beer', 5.00, true),
  ('Beer', 5.00, true)
ON CONFLICT (category_name) DO UPDATE SET tax_rate = EXCLUDED.tax_rate;

-- 3. Bar-Scoped Backups & Audit History
CREATE TABLE IF NOT EXISTS public.backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bar_outlets(id) ON DELETE CASCADE,
  bar_name VARCHAR(255) NOT NULL,
  data_type VARCHAR(50) NOT NULL,
  backup_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  schema_version VARCHAR(20) NOT NULL DEFAULT '2.0.0',
  data JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backups_bar ON public.backups(bar_id);
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users access own bar backups" ON public.backups;
CREATE POLICY "Auth users access own bar backups" ON public.backups
  FOR ALL TO authenticated
  USING (public.is_authorized_for_bar(bar_id))
  WITH CHECK (public.is_authorized_for_bar(bar_id));

DROP POLICY IF EXISTS "Service role full access backups" ON public.backups;
CREATE POLICY "Service role full access backups" ON public.backups
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
