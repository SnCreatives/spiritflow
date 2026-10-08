import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function runDeepAudit() {
  const supabase = getSupabaseServiceClient();
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('=== DETAILED SCHEMA & DATA INTEGRITY AUDIT ===');

  // 1. Fetch OpenAPI
  let openApiSchema: any = null;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': serviceKey!,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    if (res.ok) {
      openApiSchema = await res.json();
    }
  } catch (err: any) {
    console.error('OpenAPI error:', err);
  }

  // 2. Fetch all bar outlets
  const { data: barOutlets, error: barErr } = await supabase.from('bar_outlets').select('*');
  console.log(`\n1. BAR OUTLETS (Total: ${barOutlets?.length || 0})`);
  const barMap = new Map<string, any>();
  barOutlets?.forEach(b => {
    barMap.set(b.id, b);
    console.log(`   - ID: ${b.id} | Code: ${b.code} | Name: ${b.name} | Status: ${b.status} | Owner: ${b.owner_user_id}`);
  });

  const allOperationalTables = [
    'bar_outlets',
    'bar_user_authorizations',
    'user_bar_access',
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
    'pack_sizes'
  ];

  for (const tbl of allOperationalTables) {
    console.log(`\n================================================================`);
    console.log(`TABLE: public.${tbl}`);
    console.log(`================================================================`);

    const openApiDef = openApiSchema?.definitions?.[tbl];
    const properties = openApiDef?.properties || {};
    const requiredCols = openApiDef?.required || [];

    console.log(`Columns & Types:`);
    for (const [colName, colMeta] of Object.entries<any>(properties)) {
      const isReq = requiredCols.includes(colName) ? 'NOT NULL' : 'NULLABLE';
      const desc = colMeta.description ? ` (${colMeta.description})` : '';
      const format = colMeta.format ? ` [format: ${colMeta.format}]` : '';
      console.log(`   - ${colName}: ${colMeta.type}${format} | ${isReq}${desc}`);
    }

    // Fetch all rows
    const { data: rows, error, count } = await supabase.from(tbl).select('*', { count: 'exact' });
    if (error) {
      console.log(`   Query error: ${error.message}`);
      continue;
    }

    console.log(`Total Row Count: ${rows?.length || 0}`);

    if (rows && rows.length > 0) {
      const sample = rows[0];
      const hasBarId = 'bar_id' in sample;

      if (hasBarId) {
        const nullBarCount = rows.filter(r => r.bar_id === null || r.bar_id === undefined).length;
        const barCounts = new Map<string, number>();
        const unknownBarCount = rows.filter(r => {
          if (!r.bar_id) return false;
          barCounts.set(r.bar_id, (barCounts.get(r.bar_id) || 0) + 1);
          return !barMap.has(r.bar_id);
        }).length;

        console.log(`bar_id Analysis:`);
        console.log(`   - Null bar_id rows: ${nullBarCount}`);
        console.log(`   - Unknown/Invalid bar_id rows: ${unknownBarCount}`);
        console.log(`   - Distribution across bars:`);
        for (const [bId, c] of barCounts.entries()) {
          const bName = barMap.get(bId)?.name || 'UNKNOWN BAR';
          console.log(`       * ${bName} (${bId}): ${c} rows`);
        }
      } else {
        console.log(`Global / Shared table (no bar_id column).`);
      }
    }
  }

  // 3. Foreign key & child consistency checks
  console.log('\n================================================================');
  console.log('RELATIONAL INTEGRITY & PARENT/CHILD CONSISTENCY');
  console.log('================================================================');

  // Purchases -> Purchase Items
  const { data: purchases } = await supabase.from('purchases').select('id, bar_id');
  const { data: pItems } = await supabase.from('purchase_items').select('id, purchase_id, bar_id');
  const pMap = new Map((purchases || []).map(p => [p.id, p]));
  let pItemOrphans = 0;
  let pItemBarMismatches = 0;
  pItems?.forEach(item => {
    const parent = pMap.get(item.purchase_id);
    if (!parent) {
      pItemOrphans++;
    } else if (item.bar_id && item.bar_id !== parent.bar_id) {
      pItemBarMismatches++;
    }
  });
  console.log(`Purchases & Purchase Items:`);
  console.log(`   - Total Purchases: ${purchases?.length || 0}`);
  console.log(`   - Total Purchase Items: ${pItems?.length || 0}`);
  console.log(`   - Orphan Items (no parent): ${pItemOrphans}`);
  console.log(`   - Bar ID Mismatches with parent: ${pItemBarMismatches}`);

  // Sales -> Sales Items
  const { data: sales } = await supabase.from('sales_transactions').select('id, bar_id');
  const { data: sItems } = await supabase.from('sales_transaction_items').select('id, sale_id, bar_id');
  const sMap = new Map((sales || []).map(s => [s.id, s]));
  let sItemOrphans = 0;
  let sItemBarMismatches = 0;
  sItems?.forEach(item => {
    const parent = sMap.get(item.sale_id);
    if (!parent) {
      sItemOrphans++;
    } else if (item.bar_id && item.bar_id !== parent.bar_id) {
      sItemBarMismatches++;
    }
  });
  console.log(`Sales & Sales Items:`);
  console.log(`   - Total Sales Transactions: ${sales?.length || 0}`);
  console.log(`   - Total Sales Items: ${sItems?.length || 0}`);
  console.log(`   - Orphan Sales Items: ${sItemOrphans}`);
  console.log(`   - Bar ID Mismatches with parent: ${sItemBarMismatches}`);

  // Stock Adjustments
  const { data: adjustments } = await supabase.from('stock_adjustments').select('id, bar_id, product_id, quantity');
  console.log(`Stock Adjustments:`);
  console.log(`   - Total records: ${adjustments?.length || 0}`);

  // Inventory isolation verification
  const { data: inventory } = await supabase.from('inventory').select('id, bar_id, product_id, current_quantity');
  console.log(`Inventory Table:`);
  console.log(`   - Total records: ${inventory?.length || 0}`);
  const invBarProdMap = new Map<string, number>();
  let invDuplicates = 0;
  inventory?.forEach(inv => {
    const key = `${inv.bar_id}:${inv.product_id}`;
    if (invBarProdMap.has(key)) {
      invDuplicates++;
    } else {
      invBarProdMap.set(key, 1);
    }
  });
  console.log(`   - Duplicate (bar_id, product_id) pairs: ${invDuplicates} (Expected: 0)`);
}

runDeepAudit().catch(console.error);
