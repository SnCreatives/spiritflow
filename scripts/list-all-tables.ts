
import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';
import dotenv from 'dotenv';
dotenv.config();

async function listAllTables() {
  const supabase = getSupabaseServiceClient();
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('--- FETCHING OPENAPI SPEC ---');
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': serviceKey!,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    if (res.ok) {
      const spec = await res.json();
      console.log('Available Tables/Views:');
      Object.keys(spec.definitions || {}).forEach(t => console.log(` - ${t}`));
    } else {
      console.log('Failed to fetch spec:', res.status);
    }
  } catch (err: any) {
    console.log('Error:', err.message);
  }
}

listAllTables().catch(console.error);
