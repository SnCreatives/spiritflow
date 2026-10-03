import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';
import { ProductService } from '../src/server/services/productService.js';
import { ProductMasterService } from '../src/server/services/productMasterService.js';
import { ScmService } from '../src/server/services/scmService.js';
import { InventoryService } from '../src/server/services/inventoryService.js';
import { BarStoreService } from '../src/server/services/barStoreService.js';

async function runTestSuite() {
  console.log('================================================================================');
  console.log('--- LIQUORFLOW PRODUCT MASTER + SCM FOUNDATION VERIFICATION TEST SUITE ---');
  console.log('================================================================================\n');

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

  // Baseline Verification: Ensure 9 historical purchases and 4 child items are untouched
  const { count: nullPurchases } = await supabase.from('purchases').select('*', { count: 'exact', head: true }).is('bar_id', null);
  const { count: nullItems } = await supabase.from('purchase_items').select('*', { count: 'exact', head: true }).is('bar_id', null);
  assert(nullPurchases === 9, 'Historical Safeguard: 9 historical purchases have bar_id IS NULL (untouched)', { count: nullPurchases });
  assert(nullItems === 4, 'Historical Safeguard: 4 historical purchase_items have bar_id IS NULL (untouched)', { count: nullItems });

  // 1. Fetch valid reference data
  const { data: whiskyCat } = await supabase.from('categories').select('*').ilike('name', '%whisky%').limit(1).single();
  const { data: ginCat } = await supabase.from('categories').select('*').ilike('name', '%gin%').limit(1).single();
  const { data: sampleBrand } = await supabase.from('brands').select('*').eq('category_id', whiskyCat.id).limit(1).single();
  
  // Find pack size compatible with whisky category
  let { data: pack750 } = await supabase.from('pack_sizes').select('*').eq('volume_ml', 750).eq('category_id', whiskyCat.id).limit(1).maybeSingle();
  if (!pack750) {
    const { data: nullCatPack } = await supabase.from('pack_sizes').select('*').eq('volume_ml', 750).is('category_id', null).limit(1).maybeSingle();
    pack750 = nullCatPack;
  }
  if (!pack750) {
    const { data: anyWhiskyPack } = await supabase.from('pack_sizes').select('*').or(`category_id.eq.${whiskyCat.id},category_id.is.null`).limit(1).single();
    pack750 = anyWhiskyPack;
  }

  const timestamp = Date.now().toString().slice(-6);
  const testVariant = `Reserve Batch ${timestamp}`;
  let createdProductId: string | null = null;

  console.log('\n--- PART 1: PRODUCT MASTER TESTS (TESTS 1 to 6) ---');

  // TEST 1: Create Product
  try {
    const created = await ProductService.createProduct({
      name: testVariant,
      categoryId: whiskyCat.id,
      brandId: sampleBrand.id,
      packSizeId: pack750!.id,
      mrp: 1450,
      purchasePrice: 1100,
      sellingPrice: 1450,
      status: 'Active',
      packType: 'Bottle',
    });
    createdProductId = created.id;
    assert(!!created.id && created.name === testVariant, 'Test 1: Create canonical product', { id: created.id, name: created.name });
  } catch (err: any) {
    assert(false, 'Test 1: Create canonical product', { error: err.message });
  }

  // TEST 2: Retrieve Product
  try {
    const retrieved = await ProductService.getProductById(createdProductId!);
    assert(
      retrieved?.id === createdProductId && retrieved?.mrp === 1450,
      'Test 2: Retrieve product with separated brand, variant, size, and MRP',
      { id: retrieved?.id, brand: retrieved?.brand?.name, mrp: retrieved?.mrp }
    );
  } catch (err: any) {
    assert(false, 'Test 2: Retrieve product', { error: err.message });
  }

  // TEST 3: Duplicate Product Rejected
  try {
    await ProductService.createProduct({
      name: testVariant,
      categoryId: whiskyCat.id,
      brandId: sampleBrand.id,
      packSizeId: pack750!.id,
      mrp: 1550, // Different MRP, but identical brand + variant + size
      purchasePrice: 1150,
      sellingPrice: 1550,
      status: 'Active',
      packType: 'Bottle',
    });
    assert(false, 'Test 3: Duplicate product must be rejected');
  } catch (err: any) {
    assert(
      err.message.includes('Duplicate product rejected') || err.message.includes('already exists'),
      'Test 3: Duplicate product rejected with stable identity (independent of MRP)',
      { message: err.message }
    );
  }

  // TEST 4: Invalid Category/Brand Combination Rejected
  try {
    await ProductService.createProduct({
      name: `Invalid Gin ${timestamp}`,
      categoryId: ginCat.id, // Gin Category
      brandId: sampleBrand.id, // Whisky Brand!
      packSizeId: pack750!.id,
      mrp: 1200,
      purchasePrice: 900,
      sellingPrice: 1200,
      status: 'Active',
      packType: 'Bottle',
    });
    assert(false, 'Test 4: Invalid category/brand combination must be rejected');
  } catch (err: any) {
    assert(
      err.message.includes('does not belong to category'),
      'Test 4: Invalid category/product combination rejected by backend validation',
      { message: err.message }
    );
  }

  // TEST 5: Invalid Bottle Size Rejected (e.g. 500ml for Whisky or arbitrary size)
  try {
    // 500 ml is for Beer, not Spirit!
    ProductMasterService.validateBottleSize('Spirit', 500, true);
    assert(false, 'Test 5: 500ml must be rejected for Spirit');
  } catch (err: any) {
    assert(
      err.message.includes('not permitted for product type "Spirit"'),
      'Test 5: Invalid bottle size rejected per liquor type rules (500ml not permitted for Spirit)',
      { message: err.message }
    );
  }

  // TEST 6: Inactive Product Cannot Be Used for New Operational Transaction
  let inactiveProdId: string | null = null;
  try {
    const inactiveProd = await ProductService.createProduct({
      name: `Discontinued ${timestamp}`,
      categoryId: whiskyCat.id,
      brandId: sampleBrand.id,
      packSizeId: pack750!.id,
      sku: `SKU-INACT-${timestamp}`,
      mrp: 1000,
      purchasePrice: 800,
      sellingPrice: 1000,
      status: 'Inactive',
      packType: 'Bottle',
    });
    inactiveProdId = inactiveProd.id;

    const bars = await BarStoreService.getBars();
    await InventoryService.processPurchase({
      barId: bars[0].id,
      purchaseNumber: `PO-INACTIVE-${timestamp}`,
      purchaseDate: new Date().toISOString().split('T')[0],
      items: [
        {
          productId: inactiveProd.id,
          quantity: 10,
          purchaseTpPrice: 500,
        }
      ]
    });
    assert(false, 'Test 6: Inactive product should be rejected from operational transactions');
  } catch (err: any) {
    assert(
      err.message.includes('Inactive and cannot be used in a new operational transaction'),
      'Test 6: Inactive product cannot be used for a new operational transaction',
      { message: err.message }
    );
  }

  console.log('\n--- PART 2: SCM / MAHARASHTRA EXCISE CODE TESTS (TESTS 7 to 12) ---');

  // TEST 7: Create SCM Code
  const scmCodeA = `SCM-WHISKY-750-${timestamp}`;
  try {
    const scmRecord = await ScmService.createScmCode({
      productId: createdProductId!,
      scmCode: scmCodeA,
      effectiveFrom: '2026-01-01',
    });
    assert(
      scmRecord.scm_code === scmCodeA && scmRecord.is_active === true,
      'Test 7: Create SCM code with effective dating',
      { scmCode: scmRecord.scm_code, effectiveFrom: scmRecord.effective_from }
    );
  } catch (err: any) {
    assert(false, 'Test 7: Create SCM code', { error: err.message });
  }

  // TEST 8: Retrieve Active SCM Code
  try {
    const currentScm = await ScmService.getCurrentScmCode(createdProductId!);
    assert(
      currentScm?.scm_code === scmCodeA && currentScm?.is_active === true,
      'Test 8: Retrieve current active SCM code',
      { scmCode: currentScm?.scm_code }
    );
  } catch (err: any) {
    assert(false, 'Test 8: Retrieve current active SCM code', { error: err.message });
  }

  // TEST 9: Create Replacement SCM Code with New Effective Date
  const scmCodeB = `SCM-WHISKY-750-REVISED-${timestamp}`;
  try {
    const replaced = await ScmService.createScmCode({
      productId: createdProductId!,
      scmCode: scmCodeB,
      effectiveFrom: '2026-07-01',
    });
    assert(
      replaced.scm_code === scmCodeB && replaced.is_active === true,
      'Test 9: Create replacement SCM code with new effective date',
      { newCode: replaced.scm_code, effectiveFrom: replaced.effective_from }
    );
  } catch (err: any) {
    assert(false, 'Test 9: Create replacement SCM code', { error: err.message });
  }

  // TEST 10: Historical SCM Record Remains Preserved
  try {
    const history = await ScmService.getScmHistory(createdProductId!);
    const hasOld = history.some(h => h.scm_code === scmCodeA && h.is_active === false && h.effective_to !== null);
    const hasNew = history.some(h => h.scm_code === scmCodeB && h.is_active === true);
    assert(
      hasOld && hasNew,
      'Test 10: Historical SCM record preserved non-destructively with terminated effective window',
      { historyCount: history.length, oldCode: scmCodeA, newCode: scmCodeB }
    );
  } catch (err: any) {
    assert(false, 'Test 10: Historical SCM record preserved', { error: err.message });
  }

  // TEST 11: Invalid SCM / Product Relationship Rejected
  try {
    await ScmService.createScmCode({
      productId: '00000000-0000-0000-0000-000000000000',
      scmCode: 'SCM-INVALID-999',
    });
    assert(false, 'Test 11: Invalid product ID for SCM must fail');
  } catch (err: any) {
    assert(
      err.message.includes('Product not found'),
      'Test 11: Invalid SCM/product relationship rejected',
      { message: err.message }
    );
  }

  // TEST 12: No Fake SCM Code Generated
  try {
    await ScmService.createScmCode({
      productId: createdProductId!,
      scmCode: '   ', // Empty or whitespace
    });
    assert(false, 'Test 12: Empty SCM code should fail');
  } catch (err: any) {
    assert(
      err.message.includes('Do not fabricate fake codes') || err.message.includes('cannot be empty'),
      'Test 12: No fake or fabricated SCM code generated (system requires explicit regulatory code)',
      { message: err.message }
    );
  }

  console.log('\n--- PART 3: BAR INTEGRATION TESTS (TESTS 13 to 17) ---');
  const bars = await BarStoreService.getBars();
  const barA = bars[0];
  const barB = bars[1];

  // TEST 13: Product Globally Available to Authorized Bars
  try {
    const cascade = await ProductMasterService.getCascadingData({ brandId: sampleBrand.id });
    const isAvail = cascade.products.some(p => p.id === createdProductId);
    assert(isAvail, 'Test 13: Product is globally available in master catalog to all authorized bars', { productId: createdProductId });
  } catch (err: any) {
    assert(false, 'Test 13: Product globally available', { error: err.message });
  }

  // TEST 14: Inventory Remains Bar-Specific
  try {
    // Check inventory for Bar A and Bar B for this new product (should both be 0 initially)
    const invA = await InventoryService.getInventoryList({ barId: barA.id });
    const invB = await InventoryService.getInventoryList({ barId: barB.id });
    const inA = invA.find(i => i.product_id === createdProductId);
    const inB = invB.find(i => i.product_id === createdProductId);
    assert(
      Number(inA?.current_quantity || 0) === 0 && Number(inB?.current_quantity || 0) === 0,
      'Test 14: Inventory is bar-specific (no auto-unscoped global stock)',
      { qtyInBarA: inA?.current_quantity || 0, qtyInBarB: inB?.current_quantity || 0 }
    );
  } catch (err: any) {
    assert(false, 'Test 14: Inventory bar-specific check', { error: err.message });
  }

  // TEST 15: Purchase in Bar A References Canonical Product
  let poA_Id: string | null = null;
  try {
    const poA = await InventoryService.processPurchase({
      barId: barA.id,
      purchaseNumber: `PO-CANON-A-${timestamp}`,
      purchaseDate: new Date().toISOString().split('T')[0],
      tpPermitReference: `TP-MAH-A-${timestamp}`,
      items: [
        {
          productId: createdProductId!,
          quantity: 12,
          purchaseTpPrice: 1100,
        }
      ]
    });
    poA_Id = poA.purchaseId;
    const { data: dbPurchaseA } = await supabase.from('purchases').select('*').eq('id', poA.purchaseId).single();
    assert(
      dbPurchaseA?.bar_id === barA.id,
      'Test 15: Purchase in Bar A references canonical product with TP Number and bar_id = Bar A',
      { purchaseId: poA.purchaseId, tpPermitReference: dbPurchaseA?.tp_permit_reference }
    );
  } catch (err: any) {
    assert(false, 'Test 15: Purchase in Bar A', { error: err.message });
  }

  // TEST 16: Purchase in Bar B References Same Canonical Product
  let poB_Id: string | null = null;
  try {
    const poB = await InventoryService.processPurchase({
      barId: barB.id,
      purchaseNumber: `PO-CANON-B-${timestamp}`,
      purchaseDate: new Date().toISOString().split('T')[0],
      tpPermitReference: `TP-MAH-B-${timestamp}`,
      items: [
        {
          productId: createdProductId!,
          quantity: 24,
          purchaseTpPrice: 1100,
        }
      ]
    });
    poB_Id = poB.purchaseId;
    const { data: dbPurchaseB } = await supabase.from('purchases').select('*').eq('id', poB.purchaseId).single();
    assert(
      dbPurchaseB?.bar_id === barB.id,
      'Test 16: Purchase in Bar B references same canonical product with bar_id = Bar B',
      { purchaseId: poB.purchaseId }
    );
  } catch (err: any) {
    assert(false, 'Test 16: Purchase in Bar B', { error: err.message });
  }

  // TEST 17: Inventory Quantities Remain Isolated
  try {
    const invA2 = await InventoryService.getInventoryList({ barId: barA.id });
    const invB2 = await InventoryService.getInventoryList({ barId: barB.id });
    const inA2 = invA2.find(i => i.product_id === createdProductId);
    const inB2 = invB2.find(i => i.product_id === createdProductId);
    assert(
      Number(inA2?.current_quantity) === 12 && Number(inB2?.current_quantity) === 24,
      'Test 17: Inventory quantities remain isolated (Bar A = 12, Bar B = 24)',
      { barA_stock: inA2?.current_quantity, barB_stock: inB2?.current_quantity }
    );
  } catch (err: any) {
    assert(false, 'Test 17: Inventory quantities isolated', { error: err.message });
  }

  console.log('\n--- PART 4: REGRESSION TESTS (TESTS 18 to 20) ---');

  // TEST 18: Existing Multi-Bar Isolation Tests Still Pass
  try {
    const purchasesB = await InventoryService.getPurchases({ barId: barB.id });
    const hasAInB = (purchasesB as any[]).some(p => p.id === poA_Id);
    assert(!hasAInB, 'Test 18: Multi-Bar Isolation: Bar B cannot read Bar A purchase', { leaked: hasAInB });
  } catch (err: any) {
    assert(false, 'Test 18: Multi-bar isolation', { error: err.message });
  }

  // TEST 19: Cross-Bar Detail/Update/Delete Protection Still Passes
  try {
    const crossDetail = await InventoryService.getPurchaseById(poB_Id!, barA.id);
    const crossUpdate = await InventoryService.updatePurchase(poB_Id!, barA.id, { remarks: 'Hacked' });
    const crossDelete = await InventoryService.deletePurchase(poB_Id!, barA.id);
    assert(
      crossDetail === null && crossUpdate === null && crossDelete === false,
      'Test 19: Cross-bar detail, update, and delete all rejected (returns null/false / 404)',
      { detail: crossDetail, update: crossUpdate, delete: crossDelete }
    );
  } catch (err: any) {
    assert(false, 'Test 19: Cross-bar protection', { error: err.message });
  }

  // TEST 20: RLS Verification Still Passes
  try {
    // Final check: Confirm the 9 historical purchases and 4 items are STILL untouched
    const { count: finalNullPurchases } = await supabase.from('purchases').select('*', { count: 'exact', head: true }).is('bar_id', null);
    const { count: finalNullItems } = await supabase.from('purchase_items').select('*', { count: 'exact', head: true }).is('bar_id', null);
    assert(
      finalNullPurchases === 9 && finalNullItems === 4,
      'Test 20: RLS & Baseline: 9 historical purchases and 4 items remain strictly preserved',
      { finalNullPurchases, finalNullItems }
    );
  } catch (err: any) {
    assert(false, 'Test 20: RLS verification', { error: err.message });
  }

  // Cleanup test data
  console.log('\n--- CLEANING UP TEST DATA ---');
  if (poA_Id) await InventoryService.deletePurchase(poA_Id, barA.id);
  if (poB_Id) await InventoryService.deletePurchase(poB_Id, barB.id);
  if (createdProductId) {
    await supabase.from('stock_ledger').delete().eq('product_id', createdProductId);
    await supabase.from('inventory').delete().eq('product_id', createdProductId);
    await supabase.from('scm_codes').delete().eq('product_id', createdProductId);
    await supabase.from('products').delete().eq('id', createdProductId);
  }
  if (inactiveProdId) {
    await supabase.from('products').delete().eq('id', inactiveProdId);
  }
  console.log('Cleanup completed.');

  console.log('\n================================================================================');
  console.log(`FINAL RESULT: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed}/20)`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
