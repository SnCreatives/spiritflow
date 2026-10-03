import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function testInventoryUpdate() {
  const supabase = getSupabaseServiceClient();

  const { data: invList } = await supabase.from('inventory').select('*').limit(1);
  console.log('Sample inventory row:', invList?.[0]);

  if (invList && invList[0]) {
    const row = invList[0];
    const { data: updated, error } = await supabase
      .from('inventory')
      .update({ current_quantity: 99 })
      .eq('id', row.id)
      .select();

    console.log('Update result by ID:', { updated, error });

    const { data: updated2, error: error2 } = await supabase
      .from('inventory')
      .update({ current_quantity: row.current_quantity })
      .eq('product_id', row.product_id)
      .eq('bar_id', row.bar_id)
      .select();

    console.log('Update result by product_id & bar_id:', { updated2, error: error2 });
  }
}

testInventoryUpdate().catch(console.error);
