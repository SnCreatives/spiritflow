
import pg from 'pg';
const { Client } = pg;

async function test() {
  const host = 'db.sefhgbvocnmzcgicmntu.supabase.co';
  const passwords = [
    'Atul@spiritflow',
    'Atul@spiritflow9699',
    'Liquorflow9699',
    'liquorflow9699',
    'Spiritflow9699',
    'SpiritFlow9699'
  ];

  for (const pass of passwords) {
    console.log(`Testing ${pass}...`);
    const client = new Client({
      user: 'postgres',
      host: host,
      database: 'postgres',
      password: pass,
      port: 5432,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 2000
    });
    try {
      await client.connect();
      console.log(`✅ SUCCESS WITH: ${pass}`);
      await client.end();
      process.exit(0);
    } catch (err: any) {
      console.log(`❌ Failed:`, err.message);
    }
  }
}
test();
