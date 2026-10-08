import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc('get_table_rls_status', { t_name: 'sessions' });
  console.log('RLS STATUS:', data || error);
}
// If RPC fails, I'll try to insert a fake record and delete it.
async function testInsert() {
  const supabase = getSupabaseServiceClient();
  const testToken = 'test-token-' + Date.now();
  console.log('Testing Insert...');
  const { error: insErr } = await supabase.from('sessions').insert({
    session_token: testToken,
    owner_id: 'b649fa66-a1c0-45fe-9184-c8164dc43ef0', // valid owner id from previous check
    expires_at: new Date(Date.now() + 60000).toISOString(),
    last_accessed_at: new Date().toISOString()
  });
  console.log('Insert Result:', insErr || 'SUCCESS');
  if (!insErr) {
    const { error: delErr } = await supabase.from('sessions').delete().eq('session_token', testToken);
    console.log('Delete Result:', delErr || 'SUCCESS');
  }
}
testInsert();
