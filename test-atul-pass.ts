import pg from 'pg';
const { Client } = pg;

async function test() {
  const url = 'postgresql://postgres:Atul@spiritflow@db.sefhgbvocnmzcgicmntu.supabase.co:5432/postgres';
  console.log(`Testing URL with Atul@spiritflow password`);
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
  try {
    await client.connect();
    console.log('SUCCESS!');
    await client.end();
  } catch (err: any) {
    console.log('FAILED:', err.message);
  }
}
test();
