
import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function test() {
  const supabase = getSupabaseServiceClient();
  
  console.log('Testing pg_tables select...');
  const { data: data1, error: err1 } = await supabase.from('pg_tables').select('*');
  console.log('pg_tables:', err1?.message || data1);

  console.log('Testing pg_policies select...');
  const { data: data2, error: err2 } = await supabase.from('pg_policies').select('*');
  console.log('pg_policies:', err2?.message || data2);
}

test();
