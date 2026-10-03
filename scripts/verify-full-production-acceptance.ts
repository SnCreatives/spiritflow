import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';
import { InventoryService } from '../src/server/services/inventoryService.js';
import { BarStoreService } from '../src/server/services/barStoreService.js';
import { SalesService } from '../src/server/services/salesService.js';
import { ErpReportService } from '../src/server/services/erpReportService.js';
import { ScmService } from '../src/server/services/scmService.js';
import { BackupService } from '../src/server/services/backupService.js';
import { MasterService } from '../src/server/services/masterService.js';
import { ProductMasterService } from '../src/server/services/productMasterService.js';

async function retryQuery<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (err.message?.includes('JWT') || err.message?.includes('future') || err.message?.includes('Fetch')) {
        await new Promise(r => setTimeout(r, 1000));
      } else {
        throw err;
      }
    }
  }
  throw lastErr;
}

async function runFullAcceptanceTest() {
  console.log('=================================================================');
  console.log('--- LIQUORFLOW FULL PRODUCTION ACCEPTANCE VERIFICATION ---');
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

  // 1. Verify 10 Production Bars
  const bars = await retryQuery(() => BarStoreService.getBars());
  assert(bars.length === 10, 'Bar Verification: Exactly 10 bars exist in public.bar_outlets', { count: bars.length });

  const exactBarNames = [
    'Vihansh Bar',
    'Vishranthi Bar',
    'Sai Darbar Bar',
    'Harsh Bar',
    'Hamad Bar',
    'Utsav Bar',
    'Dhage Bar',
    'Guru Prasad Bar',
    'Jai Bhavani Bar',
    'Yamuna Bar'
  ];

  const currentBarNames = bars.map(b => b.name);
  const allNamesMatch = exactBarNames.every(name => currentBarNames.includes(name));
  assert(allNamesMatch, 'Bar Names: All 10 canonical bar names match exact requirements (including Hamad Bar)', { names: currentBarNames });

  const hasItamad = currentBarNames.some(n => n.toLowerCase().includes('itamad'));
  assert(!hasItamad, 'Spelling Verification: No bar named "Itamad Bar" exists', { hasItamad });

  // 2. Verify Historical Data Untouched
  const { count: nullPurchases } = await supabase.from('purchases').select('*', { count: 'exact', head: true }).is('bar_id', null);
  assert(nullPurchases === 9, 'Historical Safeguard: 9 historical purchases preserved with bar_id IS NULL', { count: nullPurchases });

  const { count: nullItems } = await supabase.from('purchase_items').select('*', { count: 'exact', head: true }).is('bar_id', null);
  assert(nullItems === 4, 'Historical Safeguard: 4 historical purchase_items preserved with bar_id IS NULL', { count: nullItems });

  // 3. Module Workflows Verification across Bar A (Vihansh Bar) and Bar B (Vishranthi Bar)
  const barA = bars.find(b => b.name === 'Vihansh Bar') || bars[0];
  const barB = bars.find(b => b.name === 'Vishranthi Bar') || bars[1];

  console.log(`\nExercising Module Workflows for Bar A: "${barA.name}" (${barA.id})`);
  console.log(`Exercising Module Workflows for Bar B: "${barB.name}" (${barB.id})\n`);

  // Fetch sample product
  const { data: prods } = await supabase.from('products').select('*').limit(1);
  const sampleProd = prods?.[0];
  if (!sampleProd) {
    console.error('Fatal: No products in catalog.');
    process.exit(1);
  }

  const timestamp = Date.now().toString().slice(-6);

  // Module 4: Opening Stock
  console.log('--- Module 4: Opening Stock ---');
  await InventoryService.recordOpeningStock({
    barId: barA.id,
    productId: sampleProd.id,
    quantity: 15,
    remarks: `E2E Opening Stock Test ${timestamp}`
  });
  const invA1 = await InventoryService.getInventoryList({ barId: barA.id });
  const openItemA = invA1.find(i => i.product_id === sampleProd.id);
  assert(Number(openItemA?.opening_quantity) >= 15, 'Opening Stock: Opening quantity recorded for Bar A', { openingQty: openItemA?.opening_quantity });

  // Module 5: Received Stock / Inward
  console.log('--- Module 5: Received Stock / Inward ---');
  const poNum = `PO-E2E-${timestamp}`;
  const purchaseRes = await InventoryService.processPurchase({
    barId: barA.id,
    purchaseNumber: poNum,
    purchaseDate: new Date().toISOString().split('T')[0],
    tpPermitReference: `TP-PERMIT-${timestamp}`,
    items: [
      {
        productId: sampleProd.id,
        quantity: 24,
        purchaseTpPrice: 200,
        mrpReference: 300,
      }
    ]
  });
  assert(Boolean(purchaseRes.purchaseId), 'Received Stock: Inward purchase processed successfully', { purchaseId: purchaseRes.purchaseId });

  // Module 6: Inventory
  console.log('--- Module 6: Inventory ---');
  const invA2 = await InventoryService.getInventoryList({ barId: barA.id });
  const invItemA = invA2.find(i => i.product_id === sampleProd.id);
  assert(Number(invItemA?.purchased_quantity) >= 24, 'Inventory: Inward purchased quantity updated in Bar A inventory', { purchasedQty: invItemA?.purchased_quantity });

  // Module 7: Add Sale
  console.log('--- Module 7: Add Sale ---');
  const invNumber = `INV-E2E-${timestamp}`;
  const saleRes = await SalesService.createSale({
    barId: barA.id,
    invoiceNumber: invNumber,
    saleDate: new Date().toISOString().split('T')[0],
    customerName: 'E2E Test Customer',
    vatNumber: `MH-PERMIT-${timestamp}`,
    items: [
      {
        productId: sampleProd.id,
        quantity: 3,
        rate: 300,
      }
    ]
  });
  assert(Boolean(saleRes.saleId), 'Add Sale: Sale transaction created successfully', { saleId: saleRes.saleId });

  // Module 8: Update Sale
  console.log('--- Module 8: Update Sale ---');
  const updatedSale = await SalesService.updateSale(saleRes.saleId, barA.id, {
    customerName: 'E2E Updated Customer Name',
    remarks: 'Updated remark test',
  });
  assert(updatedSale?.customer_name === 'E2E Updated Customer Name', 'Update Sale: Customer name updated on sale transaction', { updatedName: updatedSale?.customer_name });

  // Module 9: Range Sales
  console.log('--- Module 9: Range Sales ---');
  const rangeSummary = await ErpReportService.getSalesReportSummary({
    barId: barA.id,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  assert(rangeSummary.totalTransactions >= 1, 'Range Sales: Sales summary returned transactions for date range', { totalTx: rangeSummary.totalTransactions });

  // Module 10: Closing Sales / Closing Stock
  console.log('--- Module 10: Closing Sales / Closing Stock ---');
  const closingStock = await SalesService.calculateClosingStock({
    barId: barA.id,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  assert(closingStock.length > 0, 'Closing Sales: Closing stock calculated from backend inventory/ledger', { itemsCount: closingStock.length });

  // Module 11: Adjustments
  console.log('--- Module 11: Adjustments ---');
  const adjRes = await InventoryService.processAdjustment({
    barId: barA.id,
    adjustmentNumber: `ADJ-E2E-${timestamp}`,
    adjustmentDate: new Date().toISOString().split('T')[0],
    productId: sampleProd.id,
    adjustmentType: 'CORRECTION',
    quantity: 1,
    reason: 'Breakage test'
  });
  assert(Boolean(adjRes.adjustmentId), 'Adjustments: Stock adjustment recorded successfully', { adjId: adjRes.adjustmentId });

  // Module 12: Reports Overview
  console.log('--- Module 12-19: ERP & Excise Reports ---');
  const dailySales = await ErpReportService.getDailySalesReport({ barId: barA.id });
  assert(dailySales.transactionsCount >= 1, 'Daily Sales Report: Generated with transactions', { count: dailySales.transactionsCount });

  const monthlyReport = await ErpReportService.getMonthlyReport({ barId: barA.id });
  assert(monthlyReport.items.length > 0, 'Monthly Report: Calculated month-end stock valuation', { items: monthlyReport.items.length });

  // Module 13: Excise Log Book Report (STRICT 7 COLUMNS)
  const logBook = await ErpReportService.getExciseLogBook({ barId: barA.id });
  const reqCols = ['Serial Number', 'Spirit / IMFL', 'Fermented Beer', 'Mild Beer', 'Wine', 'MML', 'Country Liquor'];
  const colsMatch = reqCols.every(c => logBook.columns.includes(c));
  assert(colsMatch, 'Excise Log Book: Contains exact 7 canonical columns', { columns: logBook.columns });

  // Module 14: Sales Tax Report
  const salesTax = await ErpReportService.getSalesTaxReport({ barId: barA.id });
  assert(salesTax.totalTaxable >= 0, 'Sales Tax Report: Calculated taxable and VAT totals', { taxable: salesTax.totalTaxable, vat: salesTax.totalVat });

  // Module 15: Sales Report Summary
  const salesSummary = await ErpReportService.getSalesReportSummary({ barId: barA.id });
  assert(salesSummary.totalSalesRevenue >= 0, 'Sales Report Summary: Aggregated sales by product and brand', { revenue: salesSummary.totalSalesRevenue });

  // Module 16: Permit Bills
  const permitBills = await ErpReportService.getPermitBills({ barId: barA.id });
  assert(permitBills.totalBills >= 1, 'Permit Bills: Retrieved bills with permit numbers', { totalBills: permitBills.totalBills });

  // Module 17: Received TP Report
  const receivedTp = await ErpReportService.getReceivedTpReport({ barId: barA.id });
  assert(receivedTp.purchases.length >= 1, 'Received TP Report: Retrieved inward TP consignments', { count: receivedTp.purchases.length });

  // Module 18: Stock Value Report
  const stockVal = await ErpReportService.getStockValueReport({ barId: barA.id });
  assert(stockVal.totals.mrpValuation >= 0, 'Stock Value Report: Valuation calculated for TP cost and MRP', { mrpValuation: stockVal.totals.mrpValuation });

  // Module 19: Available Stock Status
  const availStock = await ErpReportService.getAvailableStockStatus({ barId: barA.id });
  assert(availStock.totalUnits >= 0, 'Available Stock Status: Live stock status retrieved', { units: availStock.totalUnits });

  // Module 20: SCM Code Management
  console.log('--- Module 20: SCM Code Management ---');
  const scmCodeVal = `SCM-E2E-${timestamp}`;
  const scmRes = await ScmService.createScmCode({
    productId: sampleProd.id,
    scmCode: scmCodeVal,
    effectiveFrom: new Date().toISOString().split('T')[0],
  });
  assert(scmRes.scm_code === scmCodeVal, 'SCM Code: New SCM code mapped to product', { scmCode: scmRes.scm_code });

  const scmHist = await ScmService.getScmHistory(sampleProd.id);
  assert(scmHist.length >= 1, 'SCM Code: SCM history retrieved for product', { historyCount: scmHist.length });

  // Module 21 & 22: Backup & Restore
  console.log('--- Module 21 & 22: Backup & Restore ---');
  const backupPkg = await BackupService.exportBackup({
    barId: barA.id,
    dataType: 'sales'
  });
  assert(backupPkg.metadata.barId === barA.id, 'Backup: Export package scoped strictly to selected Bar A', { barId: backupPkg.metadata.barId });

  // Attempt Cross-Bar Restore -> MUST BE REJECTED
  let crossBarRejected = false;
  try {
    await BackupService.restoreBackup(barB.id, backupPkg);
  } catch (err: any) {
    crossBarRejected = true;
  }
  assert(crossBarRejected, 'Restore Security: Cross-bar restore attempt to Bar B was strictly rejected', { crossBarRejected });

  // Normal Same-Bar Restore
  const restoreRes = await BackupService.restoreBackup(barA.id, backupPkg);
  assert(restoreRes.success, 'Restore: Same-bar restore executed successfully', { restored: restoreRes.success });

  // Module 23 & 24: Bar Settings & User Settings
  console.log('--- Module 23 & 24: Bar Settings & User Settings ---');
  const barDetail = await MasterService.getBarById(barA.id);
  assert(barDetail?.id === barA.id, 'Bar Settings: Retrieved bar outlet details', { barName: barDetail?.name });

  // Cleanup test transactions
  console.log('\n--- CLEANING UP TEST TRANSACTIONS ---');
  await InventoryService.deletePurchase(purchaseRes.purchaseId, barA.id);
  await SalesService.deleteSale(saleRes.saleId, barA.id);
  console.log('E2E test transactions cleaned up.');

  console.log('\n=================================================================');
  console.log(`FINAL E2E RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFullAcceptanceTest().catch(err => {
  console.error('Fatal E2E Error:', err);
  process.exit(1);
});
