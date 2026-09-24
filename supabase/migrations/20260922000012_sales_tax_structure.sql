-- Create sales tax transaction tables for Sales Tax Summary report (empty by default)
CREATE TABLE IF NOT EXISTS sales_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(100) NOT NULL UNIQUE,
  invoice_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  customer_name VARCHAR(255),
  vat_number VARCHAR(100),
  total_taxable_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_invoice_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales_transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
  taxable_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 5.00, -- e.g. 5.00% or 20.00%
  vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_transactions_date ON sales_transactions(invoice_date);
CREATE INDEX IF NOT EXISTS idx_sales_transaction_items_product ON sales_transaction_items(product_id);
