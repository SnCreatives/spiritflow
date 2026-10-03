
import pg from 'pg';
const { Client } = pg;

async function test() {
  const hosts = [
    'db.sefhgbvocnmzcgicmntu.supabase.co',
    'aws-0-ap-south-1.pooler.supabase.com'
  ];
  const users = [
    'postgres',
    'postgres.sefhgbvocnmzcgicmntu'
  ];
  const pass = 'Liquorflow9699'; // Capital L
  const ports = [5432, 6543];

  for (const host of hosts) {
    for (const user of users) {
      for (const port of ports) {
        console.log(`Testing ${user}:***@${host}:${port}`);
        const client = new Client({
          user, host, database: 'postgres', password: pass, port,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 2000
        });
        try {
          await client.connect();
          console.log(`✅ SUCCESS!`);
          await client.end();
          process.exit(0);
        } catch (err: any) {
          console.log(`❌ Failed:`, err.message);
        }
      }
    }
  }
}
test();
