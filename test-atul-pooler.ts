import pg from 'pg';
const { Client } = pg;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function test() {
  const passwords = [
    'Atul@spiritflow',
    'Atul@spiritflow9699',
    'Atul@spiritflow@9699',
    'Atul_spiritflow',
    'Atul@spiritflow!',
    'Atul@spiritFlow'
  ];
  const user = 'postgres.sefhgbvocnmzcgicmntu';
  const host = 'aws-0-ap-south-1.pooler.supabase.com:6543';

  for (const pass of passwords) {
    const encodedPass = encodeURIComponent(pass);
    const url = `postgresql://${user}:${encodedPass}@${host}/postgres`;
    console.log(`Testing ${pass}...`);
    const client = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000
    });
    try {
      await client.connect();
      console.log(`✅ SUCCESS WITH PASSWORD: ${pass}`);
      await client.end();
      return;
    } catch (err: any) {
      console.log(`❌ FAILED for ${pass}:`, err.message);
    }
  }
}
test();
