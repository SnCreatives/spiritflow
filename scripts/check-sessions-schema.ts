import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.from('sessions').select('*').limit(1);
  console.log('SESSION RECORD:', data?.[0]);
  console.log('ERROR:', error);
}
check();
