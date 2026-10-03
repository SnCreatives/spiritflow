
import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function verify() {
  const supabase = getSupabaseServiceClient();

  const queries = [
    {
      name: 'Table existence',
      sql: `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('bar_outlets', 'bar_user_authorizations') ORDER BY table_name;`
    },
    {
      name: 'Columns for bar_outlets/authorizations',
      sql: `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('bar_outlets', 'bar_user_authorizations') ORDER BY table_name, ordinal_position;`
    },
    {
      name: 'Operational tables bar_id',
      sql: `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('purchases', 'purchase_items', 'inventory', 'stock_ledger', 'stock_movements', 'sales_transactions', 'sales_transaction_items', 'stock_adjustments', 'batches') AND column_name = 'bar_id' ORDER BY table_name;`
    },
    {
      name: 'Foreign keys to bar_outlets',
      sql: `SELECT tc.table_name, kcu.column_name, ccu.table_name AS referenced_table, ccu.column_name AS referenced_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND ccu.table_name = 'bar_outlets' ORDER BY tc.table_name;`
    },
    {
      name: 'RLS status',
      sql: `SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('bar_outlets', 'bar_user_authorizations', 'purchases', 'inventory', 'stock_ledger') ORDER BY tablename;`
    }
  ];

  for (const q of queries) {
    console.log(`\n--- Running: ${q.name} ---`);
    // Note: Since we cannot run arbitrary SQL via RPC, we must rely on
    // manual execution instructions as established. 
    // This script serves as a structured documentation of the queries to run in the SQL Editor.
    console.log(q.sql);
  }
}

verify().catch(console.error);
