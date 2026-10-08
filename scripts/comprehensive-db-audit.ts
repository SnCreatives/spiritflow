import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function runAudit() {
  const supabase = getSupabaseServiceClient();
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('================================================================================');
  console.log('LIQUORFLOW ERP — COMPREHENSIVE READ-ONLY DATABASE SCHEMA & INTEGRITY AUDIT');
  console.log('================================================================================\n');

  // 1. Fetch OpenAPI definition to inspect PostgREST schemas, definitions, and relationships
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
      console.log('✅ PostgREST OpenAPI spec loaded successfully.');
      console.log(`Available Definitions/Tables in OpenAPI: ${Object.keys(openApiSchema.definitions || {}).length}`);
    }
  } catch (err: any) {
    console.log('⚠️ Could not fetch OpenAPI spec directly:', err.message);
  }

  // List of tables to audit
  const targetTables = [
    'bar_outlets',
    'bar_user_authorizations',
    'user_bar_access',
    'categories',
    'brands',
    'pack_sizes',
    'products',
    'purchases',
    'purchase_items',
    'inventory',
    'stock_ledger',
    'sales_transactions',
    'sales_transaction_items',
    'stock_adjustments',
    'stock_adjustment_items',
    'daily_closing_stock',
    'batches',
    'scm_codes'
  ];

  // Also check all definitions in OpenAPI
  const allTables = openApiSchema?.definitions 
    ? Array.from(new Set([...targetTables, ...Object.keys(openApiSchema.definitions)]))
    : targetTables;

  console.log('\n--------------------------------------------------------------------------------');
  console.log('TABLE AUDIT & SCHEMA INSPECTION');
  console.log('--------------------------------------------------------------------------------\n');

  const barOutletsRes = await supabase.from('bar_outlets').select('id, name, code, is_active');
  const validBarIds = new Set((barOutletsRes.data || []).map(b => b.id));
  console.log(`Active/Configured Bar Outlets count: ${validBarIds.size}`);
  if (barOutletsRes.data) {
    barOutletsRes.data.forEach(b => console.log(` - [${b.id}] ${b.name} (${b.code || 'NO_CODE'}, active: ${b.is_active})`));
  }

  const tableAuditResults: any[] = [];

  for (const tableName of allTables) {
    const schemaDef = openApiSchema?.definitions?.[tableName];
    const properties = schemaDef?.properties || {};
    const requiredProps = schemaDef?.required || [];
    const pk = schemaDef?.['x-primary-key'] || (properties['id'] ? 'id' : 'UNKNOWN');

    // Query data from table
    const { data: rows, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .limit(100);

    if (error) {
      tableAuditResults.push({
        table: tableName,
        exists: false,
        error: error.message
      });
      continue;
    }

    const totalRows = count ?? (rows ? rows.length : 0);
    const sample = rows && rows.length > 0 ? rows[0] : null;
    const colNames = sample ? Object.keys(sample) : Object.keys(properties);

    const hasBarId = colNames.includes('bar_id');
    const barIdType = properties['bar_id']?.type || (sample && sample['bar_id'] !== undefined ? typeof sample['bar_id'] : 'N/A');
    const barIdNullable = !requiredProps.includes('bar_id');

    let nullBarIdCount = 0;
    let invalidBarIdCount = 0;
    let distinctBarsInTable = new Set<string>();

    if (hasBarId && rows) {
      for (const row of rows) {
        if (row.bar_id === null || row.bar_id === undefined) {
          nullBarIdCount++;
        } else {
          distinctBarsInTable.add(row.bar_id);
          if (!validBarIds.has(row.bar_id)) {
            invalidBarIdCount++;
          }
        }
      }
    }

    tableAuditResults.push({
      table: tableName,
      exists: true,
      totalRows,
      primaryKey: pk,
      columns: colNames,
      properties,
      hasBarId,
      barIdType,
      barIdNullable,
      nullBarIdCount,
      invalidBarIdCount,
      distinctBarsCount: distinctBarsInTable.size,
      sample
    });
  }

  // Print results
  for (const res of tableAuditResults) {
    if (!res.exists) {
      console.log(`\n❌ TABLE: public.${res.table}`);
      console.log(`   Status: NOT FOUND / ERROR (${res.error})`);
      continue;
    }

    console.log(`\n✅ TABLE: public.${res.table}`);
    console.log(`   Total Rows: ${res.totalRows}`);
    console.log(`   Primary Key: ${res.primaryKey}`);
    console.log(`   Columns (${res.columns.length}): ${res.columns.join(', ')}`);
    if (res.hasBarId) {
      console.log(`   bar_id Column: PRESENT (type: ${res.barIdType}, nullable: ${res.barIdNullable})`);
      console.log(`   NULL bar_id rows in sample: ${res.nullBarIdCount}`);
      console.log(`   Invalid bar_id rows in sample: ${res.invalidBarIdCount}`);
      console.log(`   Distinct Bars represented: ${res.distinctBarsCount}`);
    } else {
      console.log(`   bar_id Column: NONE (Catalog/Global/Lookup Table)`);
    }
  }

  // 2. Deep Integrity Audits
  console.log('\n================================================================================');
  console.log('PARENT-CHILD RELATIONSHIP & MULTI-BAR ISOLATION AUDIT');
  console.log('================================================================================\n');

  // Purchases vs Purchase Items
  console.log('1. Purchases & Purchase Items Relationship:');
  const { data: purchases } = await supabase.from('purchases').select('id, bar_id, purchase_number');
  const { data: purchaseItems } = await supabase.from('purchase_items').select('id, purchase_id, product_id, quantity, purchase_tp_price');
  
  if (purchases && purchaseItems) {
    const purchaseMap = new Map(purchases.map(p => [p.id, p]));
    let orphanItems = 0;
    for (const item of purchaseItems) {
      if (!purchaseMap.has(item.purchase_id)) {
        orphanItems++;
      }
    }
    console.log(`   Total Purchases: ${purchases.length}`);
    console.log(`   Total Purchase Items: ${purchaseItems.length}`);
    console.log(`   Orphan Purchase Items (no parent purchase): ${orphanItems}`);
  }

  // Inventory isolation per bar
  console.log('\n2. Inventory Isolation & Per-Bar Stock:');
  const { data: invRows } = await supabase.from('inventory').select('id, bar_id, product_id, current_stock');
  if (invRows) {
    console.log(`   Total Inventory records: ${invRows.length}`);
    const invByBar = new Map<string, number>();
    const invByProductAndBar = new Map<string, number>();
    let duplicateStockRecords = 0;

    for (const inv of invRows) {
      invByBar.set(inv.bar_id, (invByBar.get(inv.bar_id) || 0) + 1);
      const key = `${inv.bar_id}_${inv.product_id}`;
      if (invByProductAndBar.has(key)) {
        duplicateStockRecords++;
      } else {
        invByProductAndBar.set(key, 1);
      }
    }
    console.log(`   Unique (bar_id, product_id) duplicates: ${duplicateStockRecords}`);
    console.log('   Inventory Breakdown by Bar:');
    for (const [barId, count] of invByBar.entries()) {
      console.log(`     - Bar ID ${barId}: ${count} product stock entries`);
    }
  }

  // Stock Ledger consistency
  console.log('\n3. Stock Ledger Audit:');
  const { data: ledgerRows } = await supabase.from('stock_ledger').select('id, bar_id, product_id, transaction_type, quantity_change, closing_balance');
  if (ledgerRows) {
    console.log(`   Total Stock Ledger entries: ${ledgerRows.length}`);
    let nullLedgerBars = ledgerRows.filter(r => !r.bar_id).length;
    console.log(`   Stock Ledger entries with NULL bar_id: ${nullLedgerBars}`);
  }

  // Sales Transactions vs Items
  console.log('\n4. Sales Transactions & Items Relationship:');
  const { data: sales } = await supabase.from('sales_transactions').select('id, bar_id, bill_number');
  const { data: salesItems } = await supabase.from('sales_transaction_items').select('id, sales_transaction_id, product_id, quantity');
  if (sales && salesItems) {
    const salesMap = new Map(sales.map(s => [s.id, s]));
    let orphanSalesItems = 0;
    for (const item of salesItems) {
      if (!salesMap.has(item.sales_transaction_id)) {
        orphanSalesItems++;
      }
    }
    console.log(`   Total Sales Transactions: ${sales.length}`);
    console.log(`   Total Sales Transaction Items: ${salesItems.length}`);
    console.log(`   Orphan Sales Items: ${orphanSalesItems}`);
  }

  // Stock Adjustments
  console.log('\n5. Stock Adjustments Audit:');
  const { data: adj } = await supabase.from('stock_adjustments').select('id, bar_id');
  const { data: adjItems } = await supabase.from('stock_adjustment_items').select('id, adjustment_id');
  if (adj && adjItems) {
    const adjMap = new Map(adj.map(a => [a.id, a]));
    let orphanAdjItems = 0;
    for (const item of adjItems) {
      if (!adjMap.has(item.adjustment_id)) {
        orphanAdjItems++;
      }
    }
    console.log(`   Total Stock Adjustments: ${adj.length}`);
    console.log(`   Total Adjustment Items: ${adjItems.length}`);
    console.log(`   Orphan Adjustment Items: ${orphanAdjItems}`);
  }

  // User Authorizations
  console.log('\n6. Bar User Authorizations:');
  const { data: auths } = await supabase.from('bar_user_authorizations').select('id, bar_id, user_id, role, is_active');
  if (auths) {
    console.log(`   Total Bar User Authorizations: ${auths.length}`);
    auths.forEach(a => console.log(`     - User: ${a.user_id} -> Bar: ${a.bar_id} (role: ${a.role}, active: ${a.is_active})`));
  }
}

runAudit().catch(console.error);
