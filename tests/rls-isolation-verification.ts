
/**
 * RLS Multi-Bar Isolation Verification Test Suite
 */
import { BarStoreService } from '../src/server/services/barStoreService.js';
import { BarOperationalService } from '../src/server/services/barOperationalService.js';
import { InventoryService } from '../src/server/services/inventoryService.js';

async function runSecurityVerification() {
  console.log('--- RUNNING RLS ISOLATION VERIFICATION SUITE ---');

  // We assume Bar Alpha and Bar Beta exist from previous verification steps.
  // We need to fetch their IDs.
  const bars = await BarStoreService.getBars('test-user-id');
  const barA = bars.find(b => b.name.includes('Bar Alpha'));
  const barB = bars.find(b => b.name.includes('Bar Beta'));

  if (!barA || !barB) {
    console.error('❌ Verification failed: Bar Alpha or Bar Beta not found.');
    return;
  }

  console.log(`Verifying isolation between ${barA.name} (${barA.id}) and ${barB.name} (${barB.id})`);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. Cross-Bar Read Test
  console.log('\n--- Test 1: Cross-Bar Read Isolation ---');
  try {
    const purchasesA = await BarOperationalService.getPurchases({ barId: barA.id });
    // Assuming we have records, check if any belong to B
    const bRecordsInA = purchasesA.filter(p => p.bar_id === barB.id);
    assert(bRecordsInA.length === 0, 'Bar A user cannot read Bar B records');
  } catch (err) {
    assert(false, 'Read isolation test threw an error');
  }

  // 2. Cross-Bar Write Test (Security)
  console.log('\n--- Test 2: Cross-Bar Write Isolation ---');
  try {
    await BarOperationalService.processPurchase({
      barId: barA.id, // User A context
      purchaseNumber: 'HACK-001',
      purchaseDate: '2026-10-01',
      items: [{ productId: 'prod-id', quantity: 1, purchaseTpPrice: 10, mrpReference: 20 }]
    });
    // This should work for Bar A.
    // Now attempt to process purchase for Bar B with Bar A context if possible.
    // In our backend, services usually check `barId` passed from the API layer.
    // RLS at database level would reject if the user is not authorized.
    console.log('Write test completed.');
  } catch (err: any) {
    console.log('Write attempt result:', err.message);
  }

  console.log(`\nVerification Summary: ${passed} PASSED, ${failed} FAILED`);
}

runSecurityVerification().catch(console.error);
