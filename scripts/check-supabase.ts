
import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function check() {
  const supabase = getSupabaseServiceClient();
  console.log('Testing Supabase Client connection...');
  
  const tables = ['bar_outlets', 'bar_user_authorizations', 'user_bar_access', 'purchases', 'inventory'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ Table '${table}' check failed:`, error.message);
    } else {
      console.log(`✅ Table '${table}' exists and is accessible.`);
    }
  }
}

check().catch(console.error);
