import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const supabase = getSupabaseServiceClient();
  const { data: sessions, error } = await supabase.from('sessions').select('session_token');
  if (error) {
    console.error(error);
    return;
  }
  const tokens = sessions?.map(s => s.session_token) || [];
  const uniqueTokens = new Set(tokens);
  console.log('Total sessions:', tokens.length);
  console.log('Unique tokens:', uniqueTokens.size);
  if (tokens.length !== uniqueTokens.size) {
    console.log('DUPLICATES DETECTED!');
    const counts: Record<string, number> = {};
    tokens.forEach(t => counts[t] = (counts[t] || 0) + 1);
    Object.entries(counts).filter(([_, c]) => c > 1).forEach(([t, c]) => {
       console.log(`Token ${t.substring(0,8)}... appeared ${c} times`);
    });
  }
}
check();
