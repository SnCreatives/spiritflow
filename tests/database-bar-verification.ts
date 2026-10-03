/**
 * Database & Multi-Bar Verification Test Suite
 * Tests A, B, C, D, E as required by Master Verification Spec
 */

import { BarStoreService } from '../src/server/services/barStoreService.js';
import { BarOperationalService } from '../src/server/services/barOperationalService.js';
import { MasterService } from '../src/server/services/masterService.js';

async function runDatabaseVerification() {
  console.log('================================================================');
  console.log('--- RUNNING CANONICAL MULTI-BAR DATABASE VERIFICATION SUITE ---');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string, details?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      if (details) console.log('   Details:', details);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      if (details) console.error('   Details:', details);
      failed++;
    }
  }

  const testOwnerId = 'b649fa66-a1c0-45fe-9184-c8164dc43ef0';
  const timestamp = Date.now().toString().slice(-4);

  // --------------------------------------------------------------------------
  // TEST A: Create Bar A without entering any ID
  // --------------------------------------------------------------------------
  console.log('--- TEST A: Create Bar A without entering any ID ---');
  const barAName = `Bar Alpha ${timestamp}`;
  // User passes ONLY name (no id, no code)
  const barA = await MasterService.createBar({ name: barAName }, testOwnerId);

  assert(
    !!barA && typeof barA.id === 'string' && barA.id.length >= 16,
    'Test A: Database generates unique ID automatically for Bar A',
    { id: barA.id, name: barA.name, owner_user_id: barA.owner_user_id }
  );

  // --------------------------------------------------------------------------
  // TEST B: Create Bar B without entering any ID
  // --------------------------------------------------------------------------
  console.log('\n--- TEST B: Create Bar B without entering any ID ---');
  const barBName = `Bar Beta ${timestamp}`;
  // User passes ONLY name (no id, no code)
  const barB = await MasterService.createBar({ name: barBName }, testOwnerId);

  assert(
    !!barB && typeof barB.id === 'string' && barB.id.length >= 16,
    'Test B: Database generates unique ID automatically for Bar B',
    { id: barB.id, name: barB.name, owner_user_id: barB.owner_user_id }
  );

  // --------------------------------------------------------------------------
  // TEST C: Verify Bar A.id != Bar B.id
  // --------------------------------------------------------------------------
  console.log('\n--- TEST C: Verify Bar A.id != Bar B.id ---');
  assert(
    barA.id !== barB.id,
    'Test C: Bar A.id and Bar B.id are completely distinct generated IDs',
    { barA_id: barA.id, barB_id: barB.id }
  );

  // --------------------------------------------------------------------------
  // TEST D: Verify owner authorization automatically exists for both bars
  // --------------------------------------------------------------------------
  console.log('\n--- TEST D: Verify owner authorization automatically exists for both bars ---');
  const authsBarA = await BarStoreService.getAuthorizations({ barId: barA.id, userId: testOwnerId });
  const authsBarB = await BarStoreService.getAuthorizations({ barId: barB.id, userId: testOwnerId });

  assert(
    authsBarA.length > 0 && authsBarA[0].role === 'Owner',
    'Test D1: Owner authorization automatically exists for Bar A',
    authsBarA[0]
  );
  assert(
    authsBarB.length > 0 && authsBarB[0].role === 'Owner',
    'Test D2: Owner authorization automatically exists for Bar B',
    authsBarB[0]
  );

  // --------------------------------------------------------------------------
  // TEST E: Create an Inward for Bar A & Bar B; Verify Complete Separation
  // --------------------------------------------------------------------------
  console.log('\n--- TEST E: Inward Isolation Verification ---');
  const testProductId = 'prod-test-' + timestamp;

  // Inward for Bar A (quantity = 50)
  const inwardA = await BarOperationalService.processPurchase({
    barId: barA.id,
    purchaseNumber: `PO-ALPHA-${timestamp}`,
    purchaseDate: new Date().toISOString().split('T')[0],
    items: [
      {
        productId: testProductId,
        quantity: 50,
        purchaseTpPrice: 400,
        mrpReference: 550,
      },
    ],
  });

  assert(
    inwardA.barId === barA.id,
    'Test E1: Inward A.bar_id strictly equals Bar A.id',
    { purchaseNumber: inwardA.purchaseNumber, barId: inwardA.barId }
  );

  // Inward for Bar B (quantity = 25)
  const inwardB = await BarOperationalService.processPurchase({
    barId: barB.id,
    purchaseNumber: `PO-BETA-${timestamp}`,
    purchaseDate: new Date().toISOString().split('T')[0],
    items: [
      {
        productId: testProductId,
        quantity: 25,
        purchaseTpPrice: 400,
        mrpReference: 550,
      },
    ],
  });

  assert(
    inwardB.barId === barB.id,
    'Test E2: Inward B.bar_id strictly equals Bar B.id',
    { purchaseNumber: inwardB.purchaseNumber, barId: inwardB.barId }
  );

  // Query Purchases for Bar A
  const purchasesBarA = await BarOperationalService.getPurchases({ barId: barA.id });
  const hasInwardA = purchasesBarA.some(p => p.purchase_number === `PO-ALPHA-${timestamp}`);
  const hasInwardBInA = purchasesBarA.some(p => p.purchase_number === `PO-BETA-${timestamp}`);

  assert(
    hasInwardA && !hasInwardBInA,
    'Test E3: Purchases query for Bar A contains only Bar A inward (Bar B is isolated)',
    { countA: purchasesBarA.length }
  );

  // Query Purchases for Bar B
  const purchasesBarB = await BarOperationalService.getPurchases({ barId: barB.id });
  const hasInwardB = purchasesBarB.some(p => p.purchase_number === `PO-BETA-${timestamp}`);
  const hasInwardAInB = purchasesBarB.some(p => p.purchase_number === `PO-ALPHA-${timestamp}`);

  assert(
    hasInwardB && !hasInwardAInB,
    'Test E4: Purchases query for Bar B contains only Bar B inward (Bar A is isolated)',
    { countB: purchasesBarB.length }
  );

  // Verify stock separation
  const stockA = await BarOperationalService.getBarProductStock(barA.id, testProductId);
  const stockB = await BarOperationalService.getBarProductStock(barB.id, testProductId);

  assert(
    stockA === 50 && stockB === 25,
    'Test E5: Inventory quantities are completely separate (Bar A = 50, Bar B = 25)',
    { stockA, stockB }
  );

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runDatabaseVerification().catch(err => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
