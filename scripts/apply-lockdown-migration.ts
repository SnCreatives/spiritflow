
import fs from 'fs';
import path from 'path';
import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function applyMigration() {
  console.log('--- APPLYING LOCKDOWN MIGRATION 20261001000006_lockdown_rls_policies.sql ---');
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20261001000006_lockdown_rls_policies.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Migration SQL content loaded successfully.');
  console.log('SQL Length:', sql.length, 'characters.');

  // Verify Supabase client connection
  const supabase = getSupabaseServiceClient();
  const { data: test, error: tErr } = await supabase.from('bar_outlets').select('id').limit(1);

  if (tErr) {
    console.error('Error connecting to Supabase:', tErr.message);
  } else {
    console.log('Connected to Supabase. Found bar_outlets records count:', test?.length);
  }
}

applyMigration().catch(console.error);
