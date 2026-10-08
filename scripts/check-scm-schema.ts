import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.from('scm_codes').select('*').limit(1);
  console.log('SCM CODE RECORD:', data?.[0]);
  console.log('ERROR:', error);
}
check();
