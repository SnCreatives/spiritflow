
import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';
import dotenv from 'dotenv';
dotenv.config();

async function auditScmSchema() {
  const supabase = getSupabaseServiceClient();
  
  console.log('--- SEARCHING FOR SCM TABLES ---');
  const { data: tables, error: tableErr } = await supabase.rpc('get_tables_audit', {}); 
  // If RPC doesn't exist, I'll try to guess common names
  
  const potentialTables = ['scm_codes', 'scm_master', 'product_scm', 'excise_scm', 'scm_history'];
  for (const t of potentialTables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) {
      console.log(`✅ Table Found: public.${t}`);
      console.log('   Sample Row Keys:', Object.keys(data[0] || {}));
      
      // Audit columns more deeply if found
      const { data: cols } = await supabase.from(t).select('*').limit(1);
      if (cols && cols.length > 0) {
         console.log('   Full Sample Row:', cols[0]);
      }
    }
  }

  console.log('\n--- AUDITING PURCHASE_ITEMS COLUMNS ---');
  const { data: pItems, error: pErr } = await supabase.from('purchase_items').select('*').limit(1);
  if (!pErr) {
    console.log('Purchase Items Columns:', Object.keys(pItems[0] || {}));
    console.log('Purchase Item Sample:', pItems[0]);
  } else {
    console.log('Error fetching purchase_items:', pErr.message);
  }
  
  console.log('\n--- CHECKING FOR EXISTING SCM DATA ---');
  const testCodes = ['SCMPL0043362', 'SCMPL0043364'];
  const { data: scmMatches } = await supabase.from('scm_codes').select('*').in('scm_code', testCodes);
  console.log(`Matches for test codes in 'scm_codes':`, scmMatches);
}

auditScmSchema().catch(console.error);
