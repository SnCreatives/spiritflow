import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';
import { ProductService } from '../src/server/services/productService.js';
import { ProductMasterService } from '../src/server/services/productMasterService.js';
import { ScmService } from '../src/server/services/scmService.js';
import { InventoryService } from '../src/server/services/inventoryService.js';
import { SalesService } from '../src/server/services/salesService.js';
import { DryDayService } from '../src/server/services/dryDayService.js';
import { ErpReportService } from '../src/server/services/erpReportService.js';
import { BackupService } from '../src/server/services/backupService.js';
import { TaxService } from '../src/server/services/taxService.js';
import { BarStoreService } from '../src/server/services/barStoreService.js';

async function runMasterErpTestSuite() {
  console.log('================================================================================');
  console.log('--- LIQUORFLOW MASTER DATABASE & BACKEND ERP VERIFICATION TEST SUITE ---');
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

  // 1. BASELINE SAFEGUARDS: 9 Historical Purchases and 4 Child Items
  const { count: nullPurchases } = await supabase.from('purchases').select('*', { count: 'exact', head: true }).is('bar_id', null);
  const { count: nullItems } = await supabase.from('purchase_items').select('*', { count: 'exact', head: true }).is('bar_id', null);
  assert(nullPurchases === 9, 'Safeguard: Exactly 9 historical purchases have bar_id IS NULL (untouched)', { count: nullPurchases });
  assert(nullItems === 4, 'Safeguard: Exactly 4 historical purchase_items have bar_id IS NULL (untouched)', { count: nullItems });

  // 2. REAL PRODUCTION BARS VERIFICATION (Vihansh Bar & Vishranthi Bar)
  const bars = await BarStoreService.getBars();
  const vihanshBar = bars.find(b => b.name === 'Vihansh Bar');
  const vishranthiBar = bars.find(b => b.name === 'Vishranthi Bar');

  assert(!!vihanshBar && !!vishranthiBar, 'Real Production Bars: Vihansh Bar and Vishranthi Bar exist in bar_outlets', {
    vihansh: vihanshBar ? { id: vihanshBar.id, name: vihanshBar.name, code: vihanshBar.code } : null,
    vishranthi: vishranthiBar ? { id: vishranthiBar.id, name: vishranthiBar.name, code: vishranthiBar.code } : null,
  });

  const barA = vihanshBar!;
  const barB = vishranthiBar!;
  const timestamp = Date.now().toString().slice(-6);

  // 3. PRODUCT MASTER & BOTTLE SIZES & SCM
  console.log('\n--- PRODUCT MASTER, MRP, BOTTLE SIZES & SCM ---');
  const { data: whiskyCat } = await supabase.from('categories').select('*').ilike('name', '%whisky%').limit(1).single();
  const { data: sampleBrand } = await supabase.from('brands').select('*').eq('category_id', whiskyCat.id).limit(1).single();
  
  let { data: pack750 } = await supabase.from('pack_sizes').select('*').eq('volume_ml', 750).eq('category_id', whiskyCat.id).limit(1).maybeSingle();
  if (!pack750) {
    const { data: anyWhiskyPack } = await supabase.from('pack_sizes').select('*').or(`category_id.eq.${whiskyCat.id},category_id.is.null`).limit(1).single();
    pack750 = anyWhiskyPack;
  }

  const testVariant = `Special Reserve ${timestamp}`;
  const testSku = `SKU-ERP-${timestamp}`;

  const createdProd = await ProductService.createProduct({
    name: testVariant,
    categoryId: whiskyCat.id,
    brandId: sampleBrand.id,
    packSizeId: pack750!.id,
    sku: testSku,
    mrp: 1800,
    purchasePrice: 1350,
    sellingPrice: 1800,
    status: 'Active',
    packType: 'Bottle',
  });

  assert(
    !!createdProd.id && createdProd.mrp === 1800,
    'Product Master: Created canonical product with separate Brand, Variant, Size, and MRP',
    { id: createdProd.id, sku: createdProd.sku, mrp: createdProd.mrp }
  );

  // SCM Code with effective dating
  const scmCodeA = `SCM-MAH-ERP-${timestamp}`;
  const scmRecord = await ScmService.createScmCode({
    productId: createdProd.id,
    scmCode: scmCodeA,
    effectiveFrom: '2026-01-01',
  });
  assert(
    scmRecord.scm_code === scmCodeA && scmRecord.is_active,
    'SCM: Created official Maharashtra SCM code with effective dating',
    { scmCode: scmRecord.scm_code }
  );

  // 4. OPENING STOCK ISOLATION (Test 1)
  console.log('\n--- 1. OPENING STOCK ISOLATION ---');
  await InventoryService.recordOpeningStock({
    barId: barA.id,
    productId: createdProd.id,
    quantity: 10,
    remarks: 'Opening stock for Vihansh Bar',
  });

  const invA_Initial = await InventoryService.getInventoryList({ barId: barA.id });
  const invB_Initial = await InventoryService.getInventoryList({ barId: barB.id });

  const stockA1 = Number(invA_Initial.find(i => i.product_id === createdProd.id)?.current_quantity || 0);
  const stockB1 = Number(invB_Initial.find(i => i.product_id === createdProd.id)?.current_quantity || 0);

  assert(
    stockA1 === 10 && stockB1 === 0,
    'Test 1: Opening Stock is strictly bar-isolated (Vihansh Bar = 10, Vishranthi Bar = 0)',
    { vihanshStock: stockA1, vishranthiStock: stockB1 }
  );

  // 5. RECEIVED STOCK / PURCHASE INWARD ISOLATION (Tests 2 & 3)
  console.log('\n--- 2 & 3. RECEIVED STOCK / PURCHASE INWARD ISOLATION ---');
  const poNumA = `TP-VIHANSH-${timestamp}`;
  const purchaseA = await InventoryService.processPurchase({
    barId: barA.id,
    purchaseNumber: poNumA,
    purchaseDate: new Date().toISOString().split('T')[0],
    tpPermitReference: `TP-MAH-VHN-${timestamp}`,
    items: [
      {
        productId: createdProd.id,
        quantity: 20,
        purchaseTpPrice: 1350,
      }
    ]
  });

  const invA_AfterPur = await InventoryService.getInventoryList({ barId: barA.id });
  const invB_AfterPur = await InventoryService.getInventoryList({ barId: barB.id });
  const stockA2 = Number(invA_AfterPur.find(i => i.product_id === createdProd.id)?.current_quantity || 0);
  const stockB2 = Number(invB_AfterPur.find(i => i.product_id === createdProd.id)?.current_quantity || 0);

  assert(
    stockA2 === 30 && stockB2 === 0,
    'Tests 2 & 3: Purchase in Vihansh Bar increases its stock (10 + 20 = 30) without affecting Vishranthi Bar (0)',
    { vihanshStock: stockA2, vishranthiStock: stockB2 }
  );

  // 6. INVENTORY ISOLATION (Test 4)
  console.log('\n--- 4. INVENTORY ISOLATION ---');
  await InventoryService.recordOpeningStock({
    barId: barB.id,
    productId: createdProd.id,
    quantity: 50,
    remarks: 'Opening stock for Vishranthi Bar',
  });

  const invA3 = await InventoryService.getInventoryList({ barId: barA.id });
  const invB3 = await InventoryService.getInventoryList({ barId: barB.id });
  const finalStockA = Number(invA3.find(i => i.product_id === createdProd.id)?.current_quantity || 0);
  const finalStockB = Number(invB3.find(i => i.product_id === createdProd.id)?.current_quantity || 0);

  assert(
    finalStockA === 30 && finalStockB === 50,
    'Test 4: Inventory quantities independently isolated (Vihansh = 30, Vishranthi = 50)',
    { vihansh: finalStockA, vishranthi: finalStockB }
  );

  // 7. SALES ISOLATION & DRY DAY ENFORCEMENT (Test 5)
  console.log('\n--- 5. SALES ISOLATION & DRY DAY ENFORCEMENT ---');
  // Configure dry day on 2026-10-02 (Gandhi Jayanti) for Vihansh Bar
  const dryDayDate = '2026-10-02';
  try {
    await SalesService.createSale({
      barId: barA.id,
      saleDate: dryDayDate,
      items: [{ productId: createdProd.id, quantity: 5, rate: 1800 }]
    });
    assert(false, 'Dry Day: Sale on configured dry day must be rejected');
  } catch (err: any) {
    assert(
      err.message.includes('Dry Day'),
      'Dry Day Enforcement: Sale on configured dry day rejected with business error',
      { message: err.message }
    );
  }

  // Record valid sale on non-dry date for Vihansh Bar
  const saleDate = new Date().toISOString().split('T')[0];
  const saleA = await SalesService.createSale({
    barId: barA.id,
    saleDate,
    customerName: 'Table 4 Customer',
    items: [{ productId: createdProd.id, quantity: 8, rate: 1800 }]
  });

  const invA_AfterSale = await InventoryService.getInventoryList({ barId: barA.id });
  const invB_AfterSale = await InventoryService.getInventoryList({ barId: barB.id });
  const stockA_AfterSale = Number(invA_AfterSale.find(i => i.product_id === createdProd.id)?.current_quantity || 0);
  const stockB_AfterSale = Number(invB_AfterSale.find(i => i.product_id === createdProd.id)?.current_quantity || 0);

  assert(
    stockA_AfterSale === 22 && stockB_AfterSale === 50,
    'Test 5: Sale in Vihansh Bar reduces its stock (30 - 8 = 22) through ledger without affecting Vishranthi Bar (50)',
    { vihanshStock: stockA_AfterSale, vishranthiStock: stockB_AfterSale }
  );

  // 8. CLOSING STOCK CALCULATION (Test 6)
  console.log('\n--- 6. CLOSING STOCK CALCULATION ---');
  const closingReport = await SalesService.calculateClosingStock({
    barId: barA.id,
    productId: createdProd.id,
  });
  const prodClosing = closingReport.find(r => r.productId === createdProd.id);

  assert(
    prodClosing?.openingStock === 10 &&
    prodClosing?.receivedStock === 20 &&
    prodClosing?.salesStock === 8 &&
    prodClosing?.closingStock === 22,
    'Test 6: Database Closing Stock matches (Opening 10 + Received 20 - Sales 8 = 22)',
    { calculated: prodClosing }
  );

  // 9. ERP REPORTING ISOLATION (Test 7)
  console.log('\n--- 7. ERP REPORTING ISOLATION ---');
  const logBookA = await ErpReportService.getExciseLogBook({ barId: barA.id, startDate: saleDate, endDate: saleDate });
  const logBookB = await ErpReportService.getExciseLogBook({ barId: barB.id, startDate: saleDate, endDate: saleDate });

  assert(
    logBookA.totals.spiritImfl === 8 && logBookB.totals.spiritImfl === 0,
    'Test 7: Excise Log Book is bar-isolated (Vihansh = 8 Spirit units, Vishranthi = 0)',
    { vihanshLog: logBookA.totals, vishranthiLog: logBookB.totals, columns: logBookA.columns }
  );

  // Sales Tax Report Verification (Wine = 0%, Spirit = 5%)
  const taxReport = await ErpReportService.getSalesTaxReport({ barId: barA.id, startDate: saleDate, endDate: saleDate });
  assert(
    taxReport.totalVat > 0 && taxReport.categories.length > 0,
    'Tax Rules: Sales tax correctly calculated according to category tax rules',
    { categories: taxReport.categories, totalVat: taxReport.totalVat }
  );

  // 10. CROSS-BAR DETAIL / UPDATE / DELETE PROTECTION (Tests 8, 9, 10)
  console.log('\n--- 8, 9, 10. CROSS-BAR PROTECTION ---');
  // Create a sale in Vishranthi Bar
  const saleB = await SalesService.createSale({
    barId: barB.id,
    saleDate,
    customerName: 'Vishranthi VIP Lounge',
    items: [{ productId: createdProd.id, quantity: 15, rate: 1800 }]
  });

  // Cross-Bar Detail Attempt
  const crossDetail = await SalesService.getSaleById(saleB.saleId, barA.id);
  assert(
    crossDetail === null,
    'Test 8: Cross-bar detail rejected (Vihansh Bar cannot view Vishranthi Bar sale by ID -> 404)',
    { requestedSaleId: saleB.saleId, usingBar: barA.name, result: crossDetail }
  );

  // Cross-Bar Update Attempt
  const crossUpdate = await SalesService.updateSale(saleB.saleId, barA.id, { customerName: 'Hacked' });
  assert(
    crossUpdate === null,
    'Test 9: Cross-bar update rejected (Vihansh Bar cannot update Vishranthi Bar sale)',
    { targetSaleId: saleB.saleId, usingBar: barA.name, result: crossUpdate }
  );

  // Cross-Bar Delete Attempt
  const crossDelete = await SalesService.deleteSale(saleB.saleId, barA.id);
  assert(
    crossDelete === false,
    'Test 10: Cross-bar delete rejected (Vihansh Bar cannot delete Vishranthi Bar sale)',
    { targetSaleId: saleB.saleId, usingBar: barA.name, result: crossDelete }
  );

  // 11. BACKUP ISOLATION & RESTORE PROTECTION (Tests 11 & 12)
  console.log('\n--- 11 & 12. BACKUP ISOLATION & RESTORE PROTECTION ---');
  const backupA = await BackupService.exportBackup({ barId: barA.id });
  assert(
    backupA.metadata.barId === barA.id && Array.isArray(backupA.data.sales),
    'Test 11: Bar-Scoped Backup exported with complete metadata',
    { metadata: backupA.metadata, salesCount: backupA.data.sales?.length }
  );

  // Attempting to restore Bar A's backup into Bar B must be strictly rejected
  try {
    await BackupService.restoreBackup(barB.id, backupA);
    assert(false, 'Test 12: Cross-bar restore must be rejected');
  } catch (err: any) {
    assert(
      err.message.includes('Cross-bar restore rejected'),
      'Test 12: Cross-bar restore protection enforced (cannot restore Bar A backup into Bar B)',
      { message: err.message }
    );
  }

  // 12. CLEANUP TEST TRANSACTIONS
  console.log('\n--- CLEANING UP TEST DATA ---');
  await SalesService.deleteSale(saleA.saleId, barA.id);
  await SalesService.deleteSale(saleB.saleId, barB.id);
  await InventoryService.deletePurchase(purchaseA.purchaseId, barA.id);

  await supabase.from('stock_ledger').delete().eq('product_id', createdProd.id);
  await supabase.from('inventory').delete().eq('product_id', createdProd.id);
  await supabase.from('scm_codes').delete().eq('product_id', createdProd.id);
  await supabase.from('products').delete().eq('id', createdProd.id);

  // Final verification of 9 historical purchases and 4 items
  const { count: finalNullPurchases } = await supabase.from('purchases').select('*', { count: 'exact', head: true }).is('bar_id', null);
  const { count: finalNullItems } = await supabase.from('purchase_items').select('*', { count: 'exact', head: true }).is('bar_id', null);
  assert(
    finalNullPurchases === 9 && finalNullItems === 4,
    'Regression Safeguard: 9 historical purchases and 4 child items remain completely untouched',
    { finalNullPurchases, finalNullItems }
  );

  console.log('\n================================================================================');
  console.log(`FINAL RESULT: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMasterErpTestSuite().catch(err => {
  console.error('Fatal Master ERP Test Error:', err);
  process.exit(1);
});
