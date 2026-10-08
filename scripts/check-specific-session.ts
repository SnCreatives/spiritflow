import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const supabase = getSupabaseServiceClient();
  const tokenPrefix = '8f7c03e7';
  const { data: sessions, error } = await supabase.from('sessions').select('*');
  if (error) {
    console.error('Error:', error);
    return;
  }
  const match = sessions?.find(s => s.session_token.startsWith(tokenPrefix));
  if (match) {
    console.log('MATCH FOUND:');
    console.log('Token:', match.session_token);
    console.log('Length:', match.session_token.length);
    console.log('Expires:', match.expires_at);
    console.log('Now:', new Date().toISOString());
  } else {
    console.log('NO MATCH FOUND in DB');
  }
}
check();
