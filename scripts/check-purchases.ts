
import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function check() {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.from('purchases').select('*').limit(1);
  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Purchases sample:', data[0]);
    if (data[0]) {
      console.log('Columns:', Object.keys(data[0]));
    }
  }
}
check();
