
import { Pool } from 'pg';

const hosts = [
  'db.sefhgbvocnmzcgicmntu.supabase.co',
  'aws-0-ap-south-1.pooler.supabase.com'
];
const users = [
  'postgres',
  'postgres.sefhgbvocnmzcgicmntu'
];
const passwords = [
  'Liquorflow9699',
  'liquorflow9699',
  'Atul@spiritflow',
  'atul@spiritflow'
];
const ports = [5432, 6543];

async function probe() {
  for (const host of hosts) {
    for (const user of users) {
      for (const pass of passwords) {
        for (const port of ports) {
          const url = `postgresql://${user}:${encodeURIComponent(pass)}@${host}:${port}/postgres`;
          console.log(`Probing: ${user}:***@${host}:${port}`);
          try {
            const pool = new Pool({
              connectionString: url,
              connectionTimeoutMillis: 2000,
              ssl: { rejectUnauthorized: false }
            });
            const client = await pool.connect();
            console.log('✅ SUCCESS!');
            const res = await client.query('SELECT now()');
            console.log('Time:', res.rows[0]);
            client.release();
            await pool.end();
            process.exit(0);
          } catch (err: any) {
            console.log('❌ Failed:', err.message);
          }
        }
      }
    }
  }
}

probe();
