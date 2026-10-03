
import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function checkBars() {
  const supabase = getSupabaseServiceClient();

  console.log('--- CHECKING BARS MASTER ---');
  const { data: bars, error: bErr } = await supabase
    .from('bar_outlets')
    .select('*')
    .order('created_at', { ascending: true });

  if (bErr) {
    console.error('Error fetching bar_outlets:', bErr.message);
  } else {
    console.log(`Total bars found in database: ${bars?.length || 0}`);
    bars?.forEach((b, i) => {
      console.log(`[Bar ${i + 1}] ID: ${b.id} | Name: ${b.name} | Code: ${b.code} | Status: ${b.status} | Owner: ${b.owner_user_id}`);
    });
  }

  console.log('\n--- CHECKING OWNER CREDENTIALS ---');
  const { data: owners, error: oErr } = await supabase
    .from('owner_credentials')
    .select('*');

  if (oErr) {
    console.error('Error fetching owner_credentials:', oErr.message);
  } else {
    console.log(`Total owner credentials found: ${owners?.length || 0}`);
    owners?.forEach(o => {
      console.log('Owner Record:', o);
    });
  }

  console.log('\n--- CHECKING BAR USER AUTHORIZATIONS ---');
  const { data: auths, error: aErr } = await supabase
    .from('bar_user_authorizations')
    .select('*');

  if (aErr) {
    console.error('Error fetching bar_user_authorizations:', aErr.message);
  } else {
    console.log(`Total authorizations found: ${auths?.length || 0}`);
    auths?.forEach(a => {
      console.log(`Auth ID: ${a.id} | Bar ID: ${a.bar_id} | User ID: ${a.user_id} | Role: ${a.role} | Status: ${a.status}`);
    });
  }
}

checkBars();
