
-- Migration: 20261001000006_lockdown_rls_policies.sql
-- Objective: Secure bar_outlets, bar_user_authorizations, and all operational tables with complete RLS access control policies

-- 1. Helper Function: is_authorized_for_bar(UUID)
CREATE OR REPLACE FUNCTION public.is_authorized_for_bar(target_bar_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Service role bypasses RLS check
  IF auth.role() = 'service_role' THEN
    RETURN TRUE;
  END IF;

  IF target_bar_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 
    FROM public.bar_user_authorizations bua
    WHERE bua.bar_id = target_bar_id
      AND bua.user_id = auth.uid()
      AND bua.status = 'Active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Secure bar_outlets table
ALTER TABLE public.bar_outlets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on bar_outlets" ON public.bar_outlets;
DROP POLICY IF EXISTS "Users can view authorized bar_outlets" ON public.bar_outlets;

CREATE POLICY "Users can view authorized bar_outlets" ON public.bar_outlets
FOR SELECT
TO authenticated, service_role
USING (owner_user_id = auth.uid() OR public.is_authorized_for_bar(id));


-- 3. Secure bar_user_authorizations table
ALTER TABLE public.bar_user_authorizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on bar_user_authorizations" ON public.bar_user_authorizations;
DROP POLICY IF EXISTS "Users can view own authorizations" ON public.bar_user_authorizations;

CREATE POLICY "Users can view own authorizations" ON public.bar_user_authorizations
FOR SELECT
TO authenticated, service_role
USING (user_id = auth.uid() OR auth.role() = 'service_role');


-- 4. Secure legacy user_bar_access table
ALTER TABLE public.user_bar_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on user_bar_access" ON public.user_bar_access;
DROP POLICY IF EXISTS "Users can view own legacy bar access" ON public.user_bar_access;

CREATE POLICY "Users can view own legacy bar access" ON public.user_bar_access
FOR SELECT
TO authenticated, service_role
USING (user_id = auth.uid() OR auth.role() = 'service_role');


-- 5. Unified RLS Policies for Operational Tables (CRUD isolation)

-- Purchases
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read purchases of authorized bars" ON public.purchases;
DROP POLICY IF EXISTS "Access control for purchases" ON public.purchases;
CREATE POLICY "Access control for purchases" ON public.purchases
FOR ALL
TO authenticated, service_role
USING (public.is_authorized_for_bar(bar_id))
WITH CHECK (public.is_authorized_for_bar(bar_id));

-- Purchase Items
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Access control for purchase_items" ON public.purchase_items;
CREATE POLICY "Access control for purchase_items" ON public.purchase_items
FOR ALL
TO authenticated, service_role
USING (public.is_authorized_for_bar(bar_id))
WITH CHECK (public.is_authorized_for_bar(bar_id));

-- Inventory
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read inventory of authorized bars" ON public.inventory;
DROP POLICY IF EXISTS "Access control for inventory" ON public.inventory;
CREATE POLICY "Access control for inventory" ON public.inventory
FOR ALL
TO authenticated, service_role
USING (public.is_authorized_for_bar(bar_id))
WITH CHECK (public.is_authorized_for_bar(bar_id));

-- Batches
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Access control for batches" ON public.batches;
CREATE POLICY "Access control for batches" ON public.batches
FOR ALL
TO authenticated, service_role
USING (public.is_authorized_for_bar(bar_id))
WITH CHECK (public.is_authorized_for_bar(bar_id));

-- Stock Adjustments
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Access control for stock_adjustments" ON public.stock_adjustments;
CREATE POLICY "Access control for stock_adjustments" ON public.stock_adjustments
FOR ALL
TO authenticated, service_role
USING (public.is_authorized_for_bar(bar_id))
WITH CHECK (public.is_authorized_for_bar(bar_id));

-- Stock Ledger
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Access control for stock_ledger" ON public.stock_ledger;
CREATE POLICY "Access control for stock_ledger" ON public.stock_ledger
FOR ALL
TO authenticated, service_role
USING (public.is_authorized_for_bar(bar_id))
WITH CHECK (public.is_authorized_for_bar(bar_id));

-- Sales Transactions
ALTER TABLE public.sales_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Access control for sales_transactions" ON public.sales_transactions;
CREATE POLICY "Access control for sales_transactions" ON public.sales_transactions
FOR ALL
TO authenticated, service_role
USING (public.is_authorized_for_bar(bar_id))
WITH CHECK (public.is_authorized_for_bar(bar_id));

-- Sales Transaction Items
ALTER TABLE public.sales_transaction_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Access control for sales_transaction_items" ON public.sales_transaction_items;
CREATE POLICY "Access control for sales_transaction_items" ON public.sales_transaction_items
FOR ALL
TO authenticated, service_role
USING (public.is_authorized_for_bar(bar_id))
WITH CHECK (public.is_authorized_for_bar(bar_id));
