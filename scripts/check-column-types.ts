import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc('get_table_info', { table_name: 'sessions' });
  console.log('SESSIONS TABLE INFO:', data || error);
}
// If the RPC doesn't exist, we'll try a raw query via postgrest if possible
// But we don't have rpc for that.
// Let's try to just select one and inspect the value again.
check();
