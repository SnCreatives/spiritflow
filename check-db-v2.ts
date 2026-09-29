import { getSupabaseServiceClient } from './src/lib/supabase/client.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const supabase = getSupabaseServiceClient();
  const { data: insertData, error: insertError } = await supabase.from('bar_outlets').insert({ name: 'Test Bar', code: 'TEST-001' }).select();
  if (insertError) {
    console.log('Insert into bar_outlets FAILED:', insertError.message);
  } else {
    console.log('Insert into bar_outlets SUCCESS:', insertData);
  }

  const { data: userAccess, error: accessError } = await supabase.from('user_bar_access').select('id').limit(1);
  if (accessError) {
    console.log('Table user_bar_access does NOT exist or error:', accessError.message);
  } else {
    console.log('Table user_bar_access exists.');
  }

  const { data: invColumns, error: invError } = await supabase.rpc('inspect_table_columns', { table_name: 'inventory' });
  if (invError) {
    // If inspect_table_columns doesn't exist, try a direct select on bar_id
    const { error: colError } = await supabase.from('inventory').select('bar_id').limit(1);
    if (colError) {
      console.log('Column bar_id does NOT exist in inventory table:', colError.message);
    } else {
      console.log('Column bar_id exists in inventory table.');
    }
  } else {
    console.log('Inventory columns:', invColumns);
  }
}

check();
