
import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function check() {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.from('application_setup').select('*');
  console.log('Setup:', data, error);
}
check();
