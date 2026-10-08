import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';
import dotenv from 'dotenv';
dotenv.config();

async function audit() {
  const supabase = getSupabaseServiceClient();
  const { data: sessions, error } = await supabase.from('sessions').select('session_token, expires_at').limit(50);
  console.log('--- SESSIONS AUDIT ---');
  if (error) {
    console.error('Error fetching sessions:', error);
    return;
  }
  console.log('Total sessions found:', sessions?.length);
  const now = new Date();
  sessions?.forEach((s, i) => {
    const expires = new Date(s.expires_at);
    const isExpired = expires < now;
    console.log(`Session ${i}: ${s.session_token.substring(0, 8)}... Expires: ${s.expires_at} (${isExpired ? 'EXPIRED' : 'VALID'})`);
  });
}
audit();
