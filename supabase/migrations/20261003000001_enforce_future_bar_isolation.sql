-- Migration: 20261003000001_enforce_future_bar_isolation.sql
-- Objective: Enforce bar_id NOT NULL and Parent/Child consistency for FUTURE inserts
-- while preserving historical NULL rows untouched without failing or mutating legacy data.

-- 1. Trigger for purchases: Enforce bar_id on new inserts
CREATE OR REPLACE FUNCTION public.trg_fn_enforce_purchase_bar_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bar_id IS NULL THEN
    RAISE EXCEPTION 'bar_id is mandatory for new purchase transactions. Please select a bar before creating this transaction.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_purchase_bar_id ON public.purchases;
CREATE TRIGGER trg_enforce_purchase_bar_id
BEFORE INSERT ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_enforce_purchase_bar_id();


-- 2. Trigger for purchase_items: Enforce parent/child bar_id consistency
CREATE OR REPLACE FUNCTION public.trg_fn_enforce_purchase_item_bar_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_bar_id UUID;
BEGIN
  -- Fetch parent purchase bar_id
  SELECT bar_id INTO v_parent_bar_id
  FROM public.purchases
  WHERE id = NEW.purchase_id;

  IF v_parent_bar_id IS NOT NULL THEN
    IF NEW.bar_id IS NULL THEN
      NEW.bar_id := v_parent_bar_id;
    ELSIF NEW.bar_id <> v_parent_bar_id THEN
      RAISE EXCEPTION 'Child purchase_item bar_id (%) does not match parent purchase bar_id (%)', NEW.bar_id, v_parent_bar_id;
    END IF;
  ELSE
    IF NEW.bar_id IS NULL THEN
      RAISE EXCEPTION 'bar_id is mandatory for purchase_items';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_purchase_item_bar_consistency ON public.purchase_items;
CREATE TRIGGER trg_enforce_purchase_item_bar_consistency
BEFORE INSERT OR UPDATE ON public.purchase_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_enforce_purchase_item_bar_consistency();


-- 3. Trigger for sales_transaction_items: Enforce parent/child bar_id consistency
CREATE OR REPLACE FUNCTION public.trg_fn_enforce_sales_item_bar_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_bar_id UUID;
BEGIN
  SELECT bar_id INTO v_parent_bar_id
  FROM public.sales_transactions
  WHERE id = NEW.sale_id;

  IF v_parent_bar_id IS NOT NULL THEN
    IF NEW.bar_id IS NULL THEN
      NEW.bar_id := v_parent_bar_id;
    ELSIF NEW.bar_id <> v_parent_bar_id THEN
      RAISE EXCEPTION 'Child sales_transaction_item bar_id (%) does not match parent sale bar_id (%)', NEW.bar_id, v_parent_bar_id;
    END IF;
  ELSE
    IF NEW.bar_id IS NULL THEN
      RAISE EXCEPTION 'bar_id is mandatory for sales_transaction_items';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_sales_item_bar_consistency ON public.sales_transaction_items;
CREATE TRIGGER trg_enforce_sales_item_bar_consistency
BEFORE INSERT OR UPDATE ON public.sales_transaction_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_enforce_sales_item_bar_consistency();


-- 4. Triggers for other operational tables: Enforce bar_id on new inserts
CREATE OR REPLACE FUNCTION public.trg_fn_enforce_operational_bar_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bar_id IS NULL THEN
    RAISE EXCEPTION 'bar_id is mandatory for operational records';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- stock_ledger
DROP TRIGGER IF EXISTS trg_enforce_ledger_bar_id ON public.stock_ledger;
CREATE TRIGGER trg_enforce_ledger_bar_id
BEFORE INSERT ON public.stock_ledger
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_enforce_operational_bar_id();

-- stock_adjustments
DROP TRIGGER IF EXISTS trg_enforce_adjustment_bar_id ON public.stock_adjustments;
CREATE TRIGGER trg_enforce_adjustment_bar_id
BEFORE INSERT ON public.stock_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_enforce_operational_bar_id();

-- batches
DROP TRIGGER IF EXISTS trg_enforce_batch_bar_id ON public.batches;
CREATE TRIGGER trg_enforce_batch_bar_id
BEFORE INSERT ON public.batches
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_enforce_operational_bar_id();

-- inventory
DROP TRIGGER IF EXISTS trg_enforce_inventory_bar_id ON public.inventory;
CREATE TRIGGER trg_enforce_inventory_bar_id
BEFORE INSERT ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_enforce_operational_bar_id();

-- sales_transactions
DROP TRIGGER IF EXISTS trg_enforce_sales_bar_id ON public.sales_transactions;
CREATE TRIGGER trg_enforce_sales_bar_id
BEFORE INSERT ON public.sales_transactions
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_enforce_operational_bar_id();
