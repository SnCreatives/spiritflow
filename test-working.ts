import pg from 'pg';
const { Client } = pg;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function test() {
  const url = 'postgresql://postgres.sefhgbvocnmzcgicmntu:liquorflow9699@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
  console.log('Testing pooler with lowercase password...');
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
  try {
    await client.connect();
    console.log('✅ SUCCESS!');
    const res = await client.query('SELECT current_user, current_database();');
    console.log('Result:', res.rows[0]);
    await client.end();
  } catch (err: any) {
    console.log('❌ FAILED:', err.message);
  }
}
test();
