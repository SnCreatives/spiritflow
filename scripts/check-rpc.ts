import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function checkRpc() {
  const supabase = getSupabaseServiceClient();
  // Try querying pg_proc via postgrest if view exists, or call some known rpc names
  const testNames = ['exec_sql', 'execute_sql', 'sql', 'run_sql', 'query', 'run_migration'];
  for (const name of testNames) {
    const res = await supabase.rpc(name, { query: 'SELECT 1;' });
    console.log(`RPC ${name}:`, res.error?.code, res.error?.message);
  }
}
checkRpc();
