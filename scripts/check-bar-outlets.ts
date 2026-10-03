
import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function check() {
  const supabase = getSupabaseServiceClient();
  console.log('Testing Supabase Client connection for bar_outlets...');
  
  const { data, error } = await supabase.from('bar_outlets').select('*').limit(1);
  
  if (error) {
    console.log(`❌ Table 'bar_outlets' check failed:`, error.message);
  } else {
    console.log(`✅ Table 'bar_outlets' exists and is accessible. Data:`, data);
  }
}

check().catch(console.error);
