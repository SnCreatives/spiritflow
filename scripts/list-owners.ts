
import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function listUsers() {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.from('owner_credentials').select('id, mobile_number');
  console.log('Owners:', data, error);
}
listUsers().catch(console.error);
