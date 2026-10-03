
import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function backfill() {
  console.log('--- STARTING CHILD TRANSACTION BAR_ID BACKFILL AUDIT ---');
  const supabase = getSupabaseServiceClient();

  // 1. Backfill purchase_items
  console.log('\nAnalyzing purchase_items...');
  const { data: purchaseItems, error: piError } = await supabase
    .from('purchase_items')
    .select('id, purchase_id, bar_id');

  if (piError) {
    console.error('Error fetching purchase_items:', piError.message);
    return;
  }

  const nullPi = purchaseItems.filter(item => !item.bar_id);
  console.log(`Found ${nullPi.length} purchase_items with NULL bar_id.`);

  let resolvedPi = 0;
  let unresolvedPi = 0;

  for (const item of nullPi) {
    const { data: parent, error: pError } = await supabase
      .from('purchases')
      .select('bar_id')
      .eq('id', item.purchase_id)
      .maybeSingle();

    if (parent && parent.bar_id) {
      const { error: uError } = await supabase
        .from('purchase_items')
        .update({ bar_id: parent.bar_id })
        .eq('id', item.id);

      if (!uError) {
        resolvedPi++;
      } else {
        console.error(`Failed to update item ${item.id}:`, uError.message);
        unresolvedPi++;
      }
    } else {
      console.warn(`Unresolved purchase_item ${item.id} - parent purchase ${item.purchase_id} has no valid bar_id.`);
      unresolvedPi++;
    }
  }

  console.log(`purchase_items backfill complete: ${resolvedPi} resolved, ${unresolvedPi} unresolved.`);

  // 2. Backfill sales_transaction_items
  console.log('\nAnalyzing sales_transaction_items...');
  const { data: salesItems, error: siError } = await supabase
    .from('sales_transaction_items')
    .select('id, sale_id, bar_id');

  if (siError) {
    // If table doesn't exist or is empty, we handle it gracefully
    console.log('No sales_transaction_items found or table is unavailable:', siError.message);
  } else {
    const nullSi = salesItems.filter(item => !item.bar_id);
    console.log(`Found ${nullSi.length} sales_transaction_items with NULL bar_id.`);

    let resolvedSi = 0;
    let unresolvedSi = 0;

    for (const item of nullSi) {
      const { data: parent, error: pError } = await supabase
        .from('sales_transactions')
        .select('bar_id')
        .eq('id', item.sale_id)
        .maybeSingle();

      if (parent && parent.bar_id) {
        const { error: uError } = await supabase
          .from('sales_transaction_items')
          .update({ bar_id: parent.bar_id })
          .eq('id', item.id);

        if (!uError) {
          resolvedSi++;
        } else {
          unresolvedSi++;
        }
      } else {
        console.warn(`Unresolved sales_transaction_item ${item.id} - parent sale ${item.sale_id} has no valid bar_id.`);
        unresolvedSi++;
      }
    }
    console.log(`sales_transaction_items backfill complete: ${resolvedSi} resolved, ${unresolvedSi} unresolved.`);
  }

  console.log('\n--- BACKFILL AUDIT PROCESS COMPLETE ---');
}

backfill().catch(console.error);
