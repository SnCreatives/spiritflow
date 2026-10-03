
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'PRESENT' : 'MISSING');
if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL_VAL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'));
}
