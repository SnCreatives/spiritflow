import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const supabase = getSupabaseServiceClient();
  const { data: sessions, error } = await supabase.from('sessions').select('session_token').limit(5);
  if (error) { console.error(error); return; }
  sessions?.forEach(s => {
    console.log(`Token: "${s.session_token}" Length: ${s.session_token.length}`);
  });
}
check();
