
-- Migration: 20261001000002_multibar_rls_security.sql

-- 1. Enable RLS on all required operational tables
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_transaction_items ENABLE ROW LEVEL SECURITY;

-- 2. Define Policy: Access control based on public.bar_user_authorizations
-- This policy applies to all tables that have a bar_id column.

-- Create a helper policy for READ
CREATE OR REPLACE FUNCTION public.is_authorized_for_bar(target_bar_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the current user (via service role or anon) is authorized for the bar
  -- Note: In the Express backend using service-role, RLS is bypassed.
  -- These policies are for ensuring that if any client-side request attempts to
  -- access data via the anon key, they are strictly scoped by bar authorization.
  RETURN EXISTS (
    SELECT 1 
    FROM public.bar_user_authorizations bua
    WHERE bua.bar_id = target_bar_id
      AND bua.user_id = auth.uid() -- Requires Firebase Auth integration to function
      AND bua.status = 'Active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Apply Policies to operational tables
-- Note: This is an example policy set for 'inventory'. Similar policies 
-- must be applied to all other operational tables.

-- inventory (READ)
DROP POLICY IF EXISTS "Users can read inventory of authorized bars" ON public.inventory;
CREATE POLICY "Users can read inventory of authorized bars" ON public.inventory
  FOR SELECT USING (public.is_authorized_for_bar(bar_id));

-- purchases (READ)
DROP POLICY IF EXISTS "Users can read purchases of authorized bars" ON public.purchases;
CREATE POLICY "Users can read purchases of authorized bars" ON public.purchases
  FOR SELECT USING (public.is_authorized_for_bar(bar_id));
  
-- Add similar policies for all other tables...
