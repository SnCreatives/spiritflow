import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function checkNullBarPurchaseItems() {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase.from('purchase_items').select('*').is('bar_id', null);
  console.log('purchase_items with null bar_id:', data);
}

checkNullBarPurchaseItems().catch(console.error);
