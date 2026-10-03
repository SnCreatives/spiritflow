import dotenv from 'dotenv';
dotenv.config();
import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function inspect() {
  const supabase = getSupabaseServiceClient();
  const res1 = await supabase.from('purchases').select('*').limit(1);
  console.log('purchases select *:', res1);
  const res2 = await supabase.from('bar_outlets').select('*').limit(5);
  console.log('bar_outlets select *:', res2);
  const res3 = await supabase.from('inventory').select('*').limit(1);
  console.log('inventory select *:', res3);
  const res4 = await supabase.from('categories').select('*').limit(5);
  console.log('categories select *:', res4);
  const res5 = await supabase.from('brands').select('*').limit(5);
  console.log('brands select *:', res5);
  const res6 = await supabase.from('products').select('*').limit(5);
  console.log('products select *:', res6);
  const res7 = await supabase.from('pack_sizes').select('*').limit(5);
  console.log('pack_sizes select *:', res7);
}
inspect();
