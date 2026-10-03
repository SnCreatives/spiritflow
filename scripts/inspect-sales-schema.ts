import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function inspectSalesSchema() {
  const supabase = getSupabaseServiceClient();

  const { data: sales, error: sErr } = await supabase.from('sales_transactions').select('*').limit(1);
  console.log('sales_transactions table error or columns:');
  if (sErr) console.log('Error:', sErr.message);
  else console.log('Columns:', Object.keys(sales?.[0] || {}));

  const { data: sItems, error: siErr } = await supabase.from('sales_transaction_items').select('*').limit(1);
  console.log('\nsales_transaction_items table error or columns:');
  if (siErr) console.log('Error:', siErr.message);
  else console.log('Columns:', Object.keys(sItems?.[0] || {}));

  const { data: dryDays, error: ddErr } = await supabase.from('dry_days').select('*').limit(1);
  console.log('\ndry_days table error or columns:');
  if (ddErr) console.log('Error:', ddErr.message);
  else console.log('Columns:', Object.keys(dryDays?.[0] || {}));

  const { data: taxRules, error: trErr } = await supabase.from('tax_rules').select('*').limit(1);
  console.log('\ntax_rules table error or columns:');
  if (trErr) console.log('Error:', trErr.message);
  else console.log('Columns:', Object.keys(taxRules?.[0] || {}));
}

inspectSalesSchema().catch(console.error);
