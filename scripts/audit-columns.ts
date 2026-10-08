import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function auditColumns() {
  const supabase = getSupabaseServiceClient();

  const tables = [
    'bar_outlets',
    'purchases',
    'purchase_items',
    'inventory',
    'stock_ledger',
    'sales_transactions',
    'sales_transaction_items',
    'stock_adjustments',
    'batches',
    'products',
    'brands',
    'categories',
    'pack_sizes',
    'bar_user_authorizations',
    'user_bar_access'
  ];

  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`Table ${t}: Error ${error.message}`);
      continue;
    }
    if (data && data.length > 0) {
      console.log(`\nTable: public.${t}`);
      const row = data[0];
      for (const [k, v] of Object.entries(row)) {
        const valType = v === null ? 'null' : typeof v;
        console.log(`  - ${k}: sample_type=${valType} (val=${JSON.stringify(v)})`);
      }
    } else {
      console.log(`\nTable: public.${t} (0 rows returned)`);
    }
  }
}

auditColumns().catch(console.error);
