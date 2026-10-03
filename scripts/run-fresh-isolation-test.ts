import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';
import { InventoryService } from '../src/server/services/inventoryService.js';
import { BarStoreService } from '../src/server/services/barStoreService.js';

async function runIsolationTests() {
  console.log('=================================================================');
  console.log('--- FRESH DATABASE-BACKED ISOLATION & INVENTORY TEST SUITE ---');
  console.log('=================================================================\n');

  const supabase = getSupabaseServiceClient();

  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, desc: string, details?: any) {
    if (cond) {
      console.log(`✅ [PASS] ${desc}`);
      if (details) console.log('   Details:', details);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      if (details) console.error('   Details:', details);
      failed++;
    }
  }

  // Initial check: Verify historical 9 purchases and 4 items exist and are untouched
  const { count: initialNullPurchases } = await supabase
    .from('purchases')
    .select('*', { count: 'exact', head: true })
    .is('bar_id', null);
  assert(initialNullPurchases === 9, 'Initial State: Exactly 9 historical purchases have bar_id IS NULL', { count: initialNullPurchases });

  const { count: initialNullItems } = await supabase
    .from('purchase_items')
    .select('*', { count: 'exact', head: true })
    .is('bar_id', null);
  assert(initialNullItems === 4, 'Initial State: Exactly 4 historical purchase_items have bar_id IS NULL', { count: initialNullItems });

  // 1. Fetch bars
  const bars = await BarStoreService.getBars();
  assert(bars.length === 10, 'Canonical Bars: Exactly 10 bars exist in bar_outlets', { count: bars.length });

  const barA = bars[0]; // Main Bar Outlet (BAR-001)
  const barB = bars[1]; // Lounge Bar (BAR-002)

  console.log(`\nTesting with Bar A: "${barA.name}" (${barA.id})`);
  console.log(`Testing with Bar B: "${barB.name}" (${barB.id})\n`);

  // Fetch an existing catalog product to use for purchases
  const { data: prods } = await supabase.from('products').select('id, name').limit(1);
  const existingProd = prods?.[0];
  if (!existingProd) {
    console.error('No products found in product master');
    process.exit(1);
  }

  const timestamp = Date.now().toString().slice(-6);

  // 2. Bar A: Create Purchase
  const poNumA = `PO-TEST-BAR-A-${timestamp}`;
  const purchaseA = await InventoryService.processPurchase({
    barId: barA.id,
    purchaseNumber: poNumA,
    purchaseDate: new Date().toISOString().split('T')[0],
    items: [
      {
        productId: existingProd.id,
        quantity: 5,
        purchaseTpPrice: 150,
      }
    ]
  });

  const { data: dbPurchaseA } = await supabase
    .from('purchases')
    .select('*')
    .eq('id', purchaseA.purchaseId)
    .single();

  assert(
    dbPurchaseA?.bar_id === barA.id,
    'Bar A Purchase: Database purchase.bar_id matches Bar A ID',
    { purchaseId: purchaseA.purchaseId, bar_id: dbPurchaseA?.bar_id, expected: barA.id }
  );

  // 3. Bar B: Query purchases -> Verify Bar A purchase is NOT returned
  const purchasesBarB1 = await InventoryService.getPurchases({ barId: barB.id });
  const hasAInB = (purchasesBarB1 as any[]).some(p => p.id === purchaseA.purchaseId);
  assert(
    !hasAInB,
    'Read Isolation (A -> B): Bar B cannot see Bar A purchase',
    { barB: barB.name, searchedId: purchaseA.purchaseId, found: hasAInB }
  );

  // 4. Bar B: Create Purchase
  const poNumB = `PO-TEST-BAR-B-${timestamp}`;
  const purchaseB = await InventoryService.processPurchase({
    barId: barB.id,
    purchaseNumber: poNumB,
    purchaseDate: new Date().toISOString().split('T')[0],
    items: [
      {
        productId: existingProd.id,
        quantity: 8,
        purchaseTpPrice: 200,
      }
    ]
  });

  const { data: dbPurchaseB } = await supabase
    .from('purchases')
    .select('*')
    .eq('id', purchaseB.purchaseId)
    .single();

  assert(
    dbPurchaseB?.bar_id === barB.id,
    'Bar B Purchase: Database purchase.bar_id matches Bar B ID',
    { purchaseId: purchaseB.purchaseId, bar_id: dbPurchaseB?.bar_id, expected: barB.id }
  );

  // 5. Bar A: Query purchases -> Verify Bar B purchase is NOT returned
  const purchasesBarA1 = await InventoryService.getPurchases({ barId: barA.id });
  const hasBInA = (purchasesBarA1 as any[]).some(p => p.id === purchaseB.purchaseId);
  assert(
    !hasBInA,
    'Read Isolation (B -> A): Bar A cannot see Bar B purchase',
    { barA: barA.name, searchedId: purchaseB.purchaseId, found: hasBInA }
  );

  // 6. Cross-Bar Detail Isolation
  console.log('\n--- CROSS-BAR DETAIL / UPDATE / DELETE ISOLATION ---');
  const crossDetail = await InventoryService.getPurchaseById(purchaseB.purchaseId, barA.id);
  assert(
    crossDetail === null,
    'Cross-Bar Detail: Bar A cannot read Bar B purchase by ID (returns null / 404)',
    { requestedId: purchaseB.purchaseId, usingBar: barA.name, result: crossDetail }
  );

  // 7. Cross-Bar Update Isolation
  const crossUpdate = await InventoryService.updatePurchase(purchaseB.purchaseId, barA.id, {
    remarks: 'Malicious update attempt from Bar A'
  });
  assert(
    crossUpdate === null,
    'Cross-Bar Update: Bar A cannot update Bar B purchase (rejected / returns null)',
    { targetId: purchaseB.purchaseId, usingBar: barA.name, result: crossUpdate }
  );

  // Verify Bar B purchase remarks were NOT modified
  const { data: verifiedB } = await supabase.from('purchases').select('remarks').eq('id', purchaseB.purchaseId).single();
  assert(
    verifiedB?.remarks !== 'Malicious update attempt from Bar A',
    'Integrity: Bar B purchase remarks remained unchanged after cross-bar update attempt'
  );

  // 8. Cross-Bar Delete Isolation
  const crossDelete = await InventoryService.deletePurchase(purchaseB.purchaseId, barA.id);
  assert(
    crossDelete === false,
    'Cross-Bar Delete: Bar A cannot delete Bar B purchase (rejected / returns false)',
    { targetId: purchaseB.purchaseId, usingBar: barA.name, result: crossDelete }
  );

  // Verify Bar B purchase still exists
  const { data: stillExistsB } = await supabase.from('purchases').select('id').eq('id', purchaseB.purchaseId).single();
  assert(
    stillExistsB?.id === purchaseB.purchaseId,
    'Integrity: Bar B purchase still exists after cross-bar delete attempt'
  );

  // 9. Inventory Isolation Test (Section 10)
  console.log('\n--- INVENTORY ISOLATION TEST (FRESH TEST PRODUCT) ---');
  // Fetch full sample product from existing catalog
  const { data: fullProd } = await supabase
    .from('products')
    .select('*')
    .eq('id', existingProd.id)
    .single();

  // Create a brand fresh test product
  const testSku = `SKU-ISO-${timestamp}`;
  const { data: newProd, error: prodErr } = await supabase
    .from('products')
    .insert({
      name: `Test Isolation Product ${timestamp}`,
      product_name: `Test Isolation Product ${timestamp}`,
      sku: testSku,
      category_id: fullProd?.category_id,
      brand_id: fullProd?.brand_id,
      pack_size_id: fullProd?.pack_size_id,
      pack_type: fullProd?.pack_type || 'BTL',
      status: 'Active',
      purchase_tp_price: 100,
      mrp_reference: 150
    })
    .select('id, name')
    .single();

  if (prodErr || !newProd) {
    console.error('Failed to create fresh test product:', prodErr);
    process.exit(1);
  }
  console.log(`Created fresh test product: ${newProd.name} (ID: ${newProd.id})`);

  // Bar A: Add +10
  await InventoryService.recordOpeningStock({
    barId: barA.id,
    productId: newProd.id,
    quantity: 10,
    remarks: 'Test +10 for Bar A'
  });

  // Verify Bar B quantity remains unchanged (0)
  const invB_Initial = await InventoryService.getInventoryList({ barId: barB.id });
  const itemInB1 = invB_Initial.find(i => i.product_id === newProd.id);
  const qtyInB1 = Number(itemInB1?.current_quantity || 0);
  assert(
    qtyInB1 === 0,
    'Inventory Isolation: Bar B has 0 quantity after Bar A adds +10',
    { barB: barB.name, qty: qtyInB1 }
  );

  // Bar B: Add +20
  await InventoryService.recordOpeningStock({
    barId: barB.id,
    productId: newProd.id,
    quantity: 20,
    remarks: 'Test +20 for Bar B'
  });

  // Verify final counts: Bar A = 10, Bar B = 20
  const invA_Final = await InventoryService.getInventoryList({ barId: barA.id });
  const invB_Final = await InventoryService.getInventoryList({ barId: barB.id });

  const itemA = invA_Final.find(i => i.product_id === newProd.id);
  const itemB = invB_Final.find(i => i.product_id === newProd.id);

  const qtyA = Number(itemA?.current_quantity || 0);
  const qtyB = Number(itemB?.current_quantity || 0);

  assert(qtyA === 10, 'Final Inventory: Bar A quantity is exactly 10', { expected: 10, actual: qtyA });
  assert(qtyB === 20, 'Final Inventory: Bar B quantity is exactly 20', { expected: 20, actual: qtyB });

  // 10. Clean up test records
  console.log('\n--- CLEANING UP TEST TRANSACTIONS ---');
  // Delete test purchases
  await InventoryService.deletePurchase(purchaseA.purchaseId, barA.id);
  await InventoryService.deletePurchase(purchaseB.purchaseId, barB.id);

  // Delete test inventory & ledger entries
  await supabase.from('stock_ledger').delete().eq('product_id', newProd.id);
  await supabase.from('inventory').delete().eq('product_id', newProd.id);
  await supabase.from('products').delete().eq('id', newProd.id);
  console.log('Test purchases, inventory, and test product cleaned up.');

  // Final check: Confirm historical 9 purchases and 4 items are STILL untouched
  const { count: finalNullPurchases } = await supabase
    .from('purchases')
    .select('*', { count: 'exact', head: true })
    .is('bar_id', null);
  assert(finalNullPurchases === 9, 'Final Verification: Exactly 9 historical purchases remain preserved with bar_id IS NULL', { count: finalNullPurchases });

  const { count: finalNullItems } = await supabase
    .from('purchase_items')
    .select('*', { count: 'exact', head: true })
    .is('bar_id', null);
  assert(finalNullItems === 4, 'Final Verification: Exactly 4 historical purchase_items remain preserved with bar_id IS NULL', { count: finalNullItems });

  console.log('\n=================================================================');
  console.log(`FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runIsolationTests().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
